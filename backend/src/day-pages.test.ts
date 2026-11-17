import { describe, expect, it } from "bun:test";
import type { prisma } from "./prisma";
import { dateKeyToDate, dateToKey, ensureDayPage, getTodayDateKey } from "./day-pages";

type FakeTransaction = {
    $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<boolean>;
    todoDay: {
        findUnique: (args: { where: { date: Date } }) => Promise<{ date: Date; activated: boolean } | null>;
        update: (args: { where: { date: Date }; data: { activated: boolean } }) => Promise<{ date: Date; activated: boolean }>;
        create: (args: { data: { date: Date } }) => Promise<{ date: Date }>;
        findFirst: (args: { where: { date: { lt: Date } }; orderBy: { date: "desc" } }) => Promise<{ date: Date } | null>;
    };
    todo: {
        findMany: (args: {
            where: { day: Date; done: false; deletedAt: null };
            select: { title: true; important: true; tags: true; tagMode: true };
        }) => Promise<{ title: string; important: boolean }[]>;
        createMany: (args: {
            data: { title: string; done: false; important: boolean; carriedOver: true; day: Date }[];
        }) => Promise<{ count: number }>;
    };
};

type FakeTodo = { tags?: string[]; tagMode?: string; title: string; done: boolean; important: boolean; carriedOver: boolean; day: Date };

function createFakeDatabase(pageKeys: string[], todos: FakeTodo[], scheduled: string[] = []) {
    const inactive = new Set(scheduled);
    const pages = pageKeys.map(dateKeyToDate);
    const transaction: FakeTransaction = {
        $queryRaw: async () => true,
        todoDay: {
            findUnique: async ({ where }) => {
                const page = pages.find((item) => dateToKey(item) === dateToKey(where.date));
                return page ? { date: page, activated: !inactive.has(dateToKey(page)) } : null;
            },
            update: async ({ where }) => {
                inactive.delete(dateToKey(where.date));
                return { date: where.date, activated: true };
            },
            create: async ({ data }) => {
                pages.push(data.date);
                return data;
            },
            findFirst: async ({ where }) => {
                const page = pages
                    .filter((item) => dateToKey(item) < dateToKey(where.date.lt))
                    .toSorted((left, right) => dateToKey(right).localeCompare(dateToKey(left)))[0];
                return page ? { date: page } : null;
            }
        },
        todo: {
            findMany: async ({ where }) => todos
                .filter((todo) => dateToKey(todo.day) === dateToKey(where.day) && !todo.done)
                .map(({ title, important, tags, tagMode }) => ({ title, important, tags, tagMode })),
            createMany: async ({ data }) => {
                todos.push(...data);
                return { count: data.length };
            }
        }
    };
    const database = {
        $transaction: async <T>(operation: (client: FakeTransaction) => Promise<T>) => operation(transaction)
    };

    return { database: database as unknown as typeof prisma, pages, todos };
}

describe("日付ページ", () => {
    it("予約済みの日も当日に引き継ぎを一度だけ追加する", async () => {
        const { database, todos } = createFakeDatabase(["2026-11-16", "2026-11-17"], [
            { title: "前日の未完了", done: false, important: false, carriedOver: false, day: dateKeyToDate("2026-11-16") },
            { title: "明日の予定", done: false, important: false, carriedOver: false, day: dateKeyToDate("2026-11-17") }
        ], ["2026-11-17"]);
        await ensureDayPage("2026-11-17", database);
        await ensureDayPage("2026-11-17", database);
        const today = todos.filter((todo) => dateToKey(todo.day) === "2026-11-17");
        expect(today.map((todo) => todo.title)).toEqual(["明日の予定", "前日の未完了"]);
        expect(today.filter((todo) => todo.carriedOver)).toHaveLength(1);
    });

    it("Asia/Tokyoの日付境界で今日を判定する", () => {
        expect(getTodayDateKey(new Date("2026-10-17T14:59:59.000Z"))).toBe("2026-10-17");
        expect(getTodayDateKey(new Date("2026-10-17T15:00:00.000Z"))).toBe("2026-10-18");
    });

    it("直前ページの未完了だけを新しい日に引き継ぎ、再作成しない", async () => {
        const { database, pages, todos } = createFakeDatabase(
            ["2026-10-20", "2026-10-23"],
            [
                { title: "古いページからは引き継がない", done: false, important: false, carriedOver: false, day: dateKeyToDate("2026-10-20") },
                { title: "未完了タスク", tags: ["学習"], tagMode: "manual", done: false, important: true, carriedOver: false, day: dateKeyToDate("2026-10-23") },
                { title: "完了済みタスク", done: true, important: false, carriedOver: false, day: dateKeyToDate("2026-10-23") }
            ]
        );

        await ensureDayPage("2026-10-24", database);

        const nextDayTodos = todos.filter((todo) => dateToKey(todo.day) === "2026-10-24");
        expect(pages.map(dateToKey)).toContain("2026-10-24");
        expect(nextDayTodos).toEqual([
            { title: "未完了タスク", tags: ["学習"], tagMode: "manual", done: false, important: true, carriedOver: true, day: dateKeyToDate("2026-10-24") }
        ]);

        await ensureDayPage("2026-10-24", database);
        expect(todos.filter((todo) => dateToKey(todo.day) === "2026-10-24")).toHaveLength(1);
    });

    it("過去ページがない初日は空のページだけ作る", async () => {
        const { database, pages, todos } = createFakeDatabase([], []);

        await ensureDayPage("2026-10-24", database);

        expect(pages.map(dateToKey)).toEqual(["2026-10-24"]);
        expect(todos).toEqual([]);
    });
});
