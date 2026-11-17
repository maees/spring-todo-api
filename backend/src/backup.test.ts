import { describe, expect, it } from "bun:test";
import type { prisma } from "./prisma";
import { dateKeyToDate, dateToKey } from "./day-pages";
import {
    parseBackupCsv,
    parseBackupJson,
    restoreBackup,
    toBackupCsv,
    type BackupFile
} from "./backup";

type FakeTodo = { id: bigint; title: string; done: boolean; day: Date };

function createFakeDatabase(
    pageKeys: string[],
    initialTodos: { title: string; done: boolean; day: string }[]
) {
    const pages = pageKeys.map(dateKeyToDate);
    const todos: FakeTodo[] = initialTodos.map((todo, index) => ({
        id: BigInt(index + 1),
        title: todo.title,
        done: todo.done,
        day: dateKeyToDate(todo.day)
    }));
    let nextId = BigInt(todos.length + 1);

    const transaction = {
        $queryRaw: async () => true,
        todoDay: {
            findUnique: async ({ where }: { where: { date: Date } }) =>
                pages.some((page) => dateToKey(page) === dateToKey(where.date))
                    ? { date: where.date }
                    : null,
            create: async ({ data }: { data: { date: Date } }) => {
                pages.push(data.date);
                return data;
            },
            deleteMany: async () => {
                pages.length = 0;
                todos.length = 0;
                return { count: 0 };
            }
        },
        todo: {
            findMany: async ({ where }: { where: { day: Date } }) =>
                todos.filter((todo) => dateToKey(todo.day) === dateToKey(where.day)),
            createMany: async ({ data }: { data: { title: string; done: boolean; day: Date }[] }) => {
                for (const todo of data) {
                    todos.push({ id: nextId, ...todo });
                    nextId += 1n;
                }
                return { count: data.length };
            }
        }
    };

    const database = {
        $transaction: async <T>(operation: (client: typeof transaction) => Promise<T>) => operation(transaction)
    };

    return { database: database as unknown as typeof prisma, pages, todos };
}

describe("バックアップの書き出し", () => {
    it("CSVは引用符・カンマ・改行をエスケープして往復できる", () => {
        const file: BackupFile = {
            app: "daily-flow-todo",
            version: 1,
            exportedAt: "2026-10-25T00:00:00.000Z",
            days: [
                {
                    date: "2026-10-24",
                    todos: [
                        { title: '買い物, "牛乳"', done: true },
                        { title: "改行\nあり", done: false }
                    ]
                }
            ]
        };

        const csv = toBackupCsv(file);
        expect(csv.startsWith("\uFEFFdate,title,done")).toBe(true);
        expect(parseBackupCsv(csv)).toEqual({ version: 1, days: file.days });
    });

    it("CSVはヘッダーなしでも読み込める", () => {
        expect(parseBackupCsv("2026-10-24,牛乳を買う,false\n")).toEqual({
            version: 1,
            days: [{ date: "2026-10-24", todos: [{ title: "牛乳を買う", done: false }] }]
        });
    });
});

describe("バックアップの読み込み", () => {
    it("同じ日付のTodoをまとめ、日付順に並べる", () => {
        const parsed = parseBackupJson(JSON.stringify({
            version: 1,
            days: [
                { date: "2026-10-25", todos: [{ title: " B ", done: false }] },
                { date: "2026-10-24", todos: [{ title: "A", done: true }] },
                { date: "2026-10-25", todos: [{ title: "C", done: false }] }
            ]
        }));

        expect(parsed).toEqual({
            version: 1,
            days: [
                { date: "2026-10-24", todos: [{ title: "A", done: true }] },
                { date: "2026-10-25", todos: [{ title: "B", done: false }, { title: "C", done: false }] }
            ]
        });
    });

    it("壊れたJSONや存在しない日付はエラーにする", () => {
        expect(() => parseBackupJson("{")).toThrow("JSONの形式が正しくありません");
        expect(() => parseBackupJson('{"version":2,"days":[]}')).toThrow("対応していないバックアップ形式です");
        expect(() => parseBackupCsv("date,title,done\n2026-02-30,牛乳,false")).toThrow("存在しない日付");
    });
});

describe("バックアップの復元", () => {
    const backup = {
        version: 1,
        days: [
            {
                date: "2026-10-24",
                todos: [
                    { title: "既にあるTodo", done: false },
                    { title: "新しいTodo", done: true },
                    { title: "新しいTodo", done: true }
                ]
            },
            { date: "2026-10-25", todos: [{ title: "翌日のTodo", done: false }] }
        ]
    };

    it("mergeは既存の日付を残し、重複しないTodoだけ追加する", async () => {
        const { database, pages, todos } = createFakeDatabase(
            ["2026-10-23", "2026-10-24"],
            [
                { title: "既にあるTodo", done: false, day: "2026-10-24" },
                { title: "古いTodo", done: true, day: "2026-10-23" }
            ]
        );

        const result = await restoreBackup(backup, "merge", database);

        expect(result).toEqual({
            mode: "merge",
            daysRestored: 2,
            daysCreated: 1,
            todosCreated: 2,
            todosSkipped: 2
        });
        expect(pages.map(dateToKey)).toEqual(["2026-10-23", "2026-10-24", "2026-10-25"]);
        expect(todos.filter((todo) => dateToKey(todo.day) === "2026-10-24").map((todo) => todo.title))
            .toEqual(["既にあるTodo", "新しいTodo"]);
        expect(todos.filter((todo) => dateToKey(todo.day) === "2026-10-23").map((todo) => todo.title))
            .toEqual(["古いTodo"]);
    });

    it("replaceは既存データを削除してバックアップだけにする", async () => {
        const { database, pages, todos } = createFakeDatabase(
            ["2026-10-20"],
            [{ title: "消えるTodo", done: true, day: "2026-10-20" }]
        );

        const result = await restoreBackup(backup, "replace", database);

        expect(result).toEqual({
            mode: "replace",
            daysRestored: 2,
            daysCreated: 2,
            todosCreated: 3,
            todosSkipped: 1
        });
        expect(pages.map(dateToKey)).toEqual(["2026-10-24", "2026-10-25"]);
        expect(todos.map((todo) => todo.title)).toEqual([
            "既にあるTodo",
            "新しいTodo",
            "翌日のTodo"
        ]);
    });
});

describe("タグのバックアップ", () => {
    const file: BackupFile = {
        app: "daily-flow-todo", version: 1, exportedAt: "2026-11-14T00:00:00Z",
        days: [{ date: "2026-11-14", todos: [
            { title: "会議", done: false, tags: ["学習"], tagMode: "manual" },
            { title: "薬を買う", done: true, tags: [], tagMode: "manual" }
        ] }]
    };
    it("JSONとCSVで手動タグとタグなしを保持する", () => {
        expect(parseBackupJson(JSON.stringify(file)).days).toEqual(file.days);
        expect(parseBackupCsv(toBackupCsv(file)).days).toEqual(file.days);
    });
    it("復元時も手動設定を保持する", async () => {
        const { database, todos } = createFakeDatabase([], []);
        await restoreBackup(parseBackupCsv(toBackupCsv(file)), "replace", database);
        expect(todos[0]).toMatchObject({ tags: ["学習"], tagMode: "manual" });
        expect(todos[1]).toMatchObject({ tags: [], tagMode: "manual" });
    });
});
