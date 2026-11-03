import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import todos from "./todos";
import backup from "./backup";
import routines from "./routines";
import { applyRoutines } from "./routines";
import { dateKeyToDate, dateToKey, ensureCurrentDayPage, getTodayDateKey } from "./day-pages";
import { prisma } from "./prisma";

const app = new Hono();

const dayNoteSchema = z.object({
    note: z.string().trim().max(500, "メモは500文字以内で入力してください")
});

const noteValidation = (
    result: { success: boolean; error?: { issues: { message: string }[] } },
    c: { json: (body: { errors: string[] }, status: 400) => Response }
) => {
    if (!result.success) {
        return c.json({ errors: result.error?.issues.map((issue) => issue.message) ?? [] }, 400);
    }
};

function daySummary(page: {
    date: Date;
    reviewNote: string | null;
    todos: { done: boolean; carriedOver: boolean }[];
}) {
    const todoCount = page.todos.length;
    const doneCount = page.todos.filter((todo) => todo.done).length;
    const carriedOverCount = page.todos.filter((todo) => todo.carriedOver).length;
    return {
        date: dateToKey(page.date),
        todoCount,
        doneCount,
        carriedOverCount,
        percent: todoCount === 0 ? 0 : Math.round((doneCount / todoCount) * 100),
        note: page.reviewNote ?? ""
    };
}

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.get("/api/days", async (c) => {
    await ensureCurrentDayPage();
    await applyRoutines(getTodayDateKey());
    const pages = await prisma.todoDay.findMany({
        orderBy: { date: "desc" },
        include: {
            todos: {
                where: { deletedAt: null },
                select: { done: true, carriedOver: true }
            }
        }
    });
    return c.json(pages.map(daySummary));
});

app.get("/api/days/:date", async (c) => {
    const date = c.req.param("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return c.json({ errors: ["日付はYYYY-MM-DD形式で指定してください"] }, 400);
    }

    if (date === getTodayDateKey()) await ensureCurrentDayPage();

    const page = await prisma.todoDay.findUnique({
        where: { date: dateKeyToDate(date) },
        include: {
            todos: {
                where: { deletedAt: null },
                select: { done: true, carriedOver: true }
            }
        }
    });
    if (!page) return c.json({ errors: ["日付ページが見つかりません"] }, 404);
    return c.json(daySummary(page));
});

app.put("/api/days/:date/note", zValidator("json", dayNoteSchema, noteValidation), async (c) => {
    const date = c.req.param("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return c.json({ errors: ["日付はYYYY-MM-DD形式で指定してください"] }, 400);
    }

    if (date === getTodayDateKey()) await ensureCurrentDayPage();

    const existing = await prisma.todoDay.findUnique({ where: { date: dateKeyToDate(date) } });
    if (!existing) return c.json({ errors: ["日付ページが見つかりません"] }, 404);

    const { note } = c.req.valid("json");
    const page = await prisma.todoDay.update({
        where: { date: dateKeyToDate(date) },
        data: { reviewNote: note.length > 0 ? note : null }
    });
    return c.json({ date, note: page.reviewNote ?? "" });
});
app.route("/api/todos", todos);
app.route("/api/backup", backup);
app.route("/api/routines", routines);

app.onError((error, c) => {
    console.error(error);
    return c.json({ errors: ["サーバー内部でエラーが発生しました"] }, 500);
});

const port = Number(Bun.env.PORT ?? 3000);
Bun.serve({ port, fetch: app.fetch });
console.log(`Hono API listening on http://localhost:${port}`);