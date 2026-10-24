import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "./prisma";
import { dateKeyToDate, dateToKey, ensureCurrentDayPage, getTodayDateKey } from "./day-pages";

const todoResponse = z.object({
    id: z.string(),
    title: z.string(),
    done: z.boolean()
});

const createTodoSchema = z.object({
    title: z.string().trim().min(1, "タイトルは必須です").max(255, "タイトルは255文字以内で入力してください"),
    done: z.boolean().optional().default(false)
});

const updateTodoSchema = z.object({
    title: z.string().trim().min(1, "タイトルは必須です").max(255, "タイトルは255文字以内で入力してください"),
    done: z.boolean()
});

const todoQuerySchema = z.object({
    done: z.enum(["true", "false"]).optional(),
    date: z.iso.date().optional()
});

const todoParamsSchema = z.object({
    id: z.coerce.bigint().positive()
});

const validationResponse = (
    result: { success: boolean; error?: { issues: { message: string }[] } },
    c: { json: (body: { errors: string[] }, status: 400) => Response }
) => {
    if (!result.success) {
        return c.json({ errors: result.error?.issues.map((issue) => issue.message) ?? [] }, 400);
    }
};

function serializeTodo(todo: { id: bigint; title: string; done: boolean }) {
    return todoResponse.parse({ ...todo, id: todo.id.toString() });
}

const todos = new Hono();

todos.get("/", zValidator("query", todoQuerySchema, validationResponse), async (c) => {
    const { done, date: requestedDate } = c.req.valid("query");
    const date = requestedDate ?? getTodayDateKey();
    if (date === getTodayDateKey()) await ensureCurrentDayPage();

    const day = dateKeyToDate(date);
    const page = await prisma.todoDay.findUnique({ where: { date: day } });
    if (!page) return c.json([]);

    const result = await prisma.todo.findMany({
        where: {
            day,
            ...(done === undefined ? {} : { done: done === "true" })
        },
        orderBy: [{ done: "asc" }, { id: "asc" }]
    });
    return c.json(result.map(serializeTodo));
});

todos.get("/:id", zValidator("param", todoParamsSchema, validationResponse), async (c) => {
    const { id } = c.req.valid("param");
    const todo = await prisma.todo.findUnique({ where: { id } });
    return todo ? c.json(serializeTodo(todo)) : c.json({ errors: ["Todoが見つかりません"] }, 404);
});

todos.post("/", zValidator("json", createTodoSchema, validationResponse), async (c) => {
    const input = c.req.valid("json");
    await ensureCurrentDayPage();
    const todo = await prisma.todo.create({ data: { ...input, day: dateKeyToDate(getTodayDateKey()) } });
    return c.json(serializeTodo(todo), 201);
});

todos.put("/:id", zValidator("param", todoParamsSchema, validationResponse), zValidator("json", updateTodoSchema, validationResponse), async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const existing = await prisma.todo.findUnique({ where: { id }, select: { day: true } });
    if (!existing) return c.json({ errors: ["Todoが見つかりません"] }, 404);
    if (dateToKey(existing.day) !== getTodayDateKey()) {
        return c.json({ errors: ["過去の日付のTodoは変更できません"] }, 409);
    }
    const todo = await prisma.todo.update({ where: { id }, data: input });
    return c.json(serializeTodo(todo));
});

todos.delete("/:id", zValidator("param", todoParamsSchema, validationResponse), async (c) => {
    const { id } = c.req.valid("param");
    const existing = await prisma.todo.findUnique({ where: { id }, select: { day: true } });
    if (!existing) return c.json({ errors: ["Todoが見つかりません"] }, 404);
    if (dateToKey(existing.day) !== getTodayDateKey()) {
        return c.json({ errors: ["過去の日付のTodoは削除できません"] }, 409);
    }
    await prisma.todo.delete({ where: { id } });
    return c.body(null, 204);
});

export default todos;