import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { tagFields, resolveTags } from "./tags";
import { prisma } from "./prisma";
import { dateKeyToDate, dateToKey, ensureCurrentDayPage, getTodayDateKey } from "./day-pages";

const todoResponse = z.object({
    tags: z.array(z.string()),
    tagMode: z.enum(["auto", "manual"]),
    id: z.string(),
    title: z.string(),
    done: z.boolean(),
    important: z.boolean().optional().default(false),
    carriedOver: z.boolean().optional().default(false)
});

const createTodoSchema = z.object({
    date: z.iso.date().optional(),
    ...tagFields,
    title: z.string().trim().min(1, "タイトルは必須です").max(255, "タイトルは255文字以内で入力してください"),
    done: z.boolean().optional().default(false),
    important: z.boolean().optional().default(false)
});

const updateTodoSchema = z.object({
    date: z.iso.date().optional(),
    ...tagFields,
    title: z.string().trim().min(1, "タイトルは必須です").max(255, "タイトルは255文字以内で入力してください"),
    done: z.boolean(),
    important: z.boolean().optional()
});

const todoQuerySchema = z.object({
    done: z.enum(["true", "false"]).optional(),
    date: z.iso.date().optional()
});

const todoParamsSchema = z.object({
    id: z.coerce.bigint().positive()
});

const trashQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional().default(100)
});

const validationResponse = (
    result: { success: boolean; error?: { issues: { message: string }[] } },
    c: { json: (body: { errors: string[] }, status: 400) => Response }
) => {
    if (!result.success) {
        return c.json({ errors: result.error?.issues.map((issue) => issue.message) ?? [] }, 400);
    }
};

function serializeTodo(todo: { id: bigint; title: string; done: boolean; important?: boolean; carriedOver?: boolean; tags?: string[]; tagMode?: string }) {
    return todoResponse.parse({
        ...todo,
        ...resolveTags(todo.title, todo),
        id: todo.id.toString(),
        important: todo.important ?? false,
        carriedOver: todo.carriedOver ?? false
    });
}

function trashItem(todo: { id: bigint; title: string; done: boolean; important?: boolean; carriedOver?: boolean; tags?: string[]; tagMode?: string; day: Date; deletedAt: Date | null }) {
    return {
        ...serializeTodo(todo),
        date: dateToKey(todo.day),
        deletedAt: todo.deletedAt?.toISOString() ?? null
    };
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
            deletedAt: null,
            ...(done === undefined ? {} : { done: done === "true" })
        },
        orderBy: [{ important: "desc" }, { done: "asc" }, { id: "asc" }]
    });
    return c.json(result.map(serializeTodo));
});

todos.get("/trash", zValidator("query", trashQuerySchema, validationResponse), async (c) => {
    const { limit } = c.req.valid("query");
    const result = await prisma.todo.findMany({
        where: { deletedAt: { not: null } },
        orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
        take: limit
    });
    return c.json(result.map(trashItem));
});

todos.get("/:id", zValidator("param", todoParamsSchema, validationResponse), async (c) => {
    const { id } = c.req.valid("param");
    const todo = await prisma.todo.findUnique({ where: { id } });
    return todo && todo.deletedAt === null ? c.json(serializeTodo(todo)) : c.json({ errors: ["Todoが見つかりません"] }, 404);
});

todos.post("/", zValidator("json", createTodoSchema, validationResponse), async (c) => {
    const input = c.req.valid("json");
    const date = input.date ?? getTodayDateKey();
    if (date < getTodayDateKey()) return c.json({ errors: ["過去の日付には追加できません"] }, 409);
    await ensureCurrentDayPage();
    if (date > getTodayDateKey()) await prisma.todoDay.upsert({
        where: { date: dateKeyToDate(date) },
        create: { date: dateKeyToDate(date), activated: false },
        update: {}
    });
    const todo = await prisma.todo.create({
        data: {
            ...resolveTags(input.title, undefined, input),
            title: input.title,
            done: input.done,
            important: input.important,
            carriedOver: false,
            day: dateKeyToDate(date),
            deletedAt: null
        }
    });
    return c.json(serializeTodo(todo), 201);
});

// Classification can be corrected on archived records without changing their content.
todos.patch("/:id/tags", zValidator("param", todoParamsSchema, validationResponse), zValidator("json", z.object({
    tags: tagFields.tags.unwrap(),
    tagMode: z.enum(["auto", "manual"])
}).strict(), validationResponse), async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const existing = await prisma.todo.findUnique({ where: { id } });
    if (!existing || existing.deletedAt !== null) return c.json({ errors: ["Todoが見つかりません"] }, 404);
    const todo = await prisma.todo.update({ where: { id }, data: resolveTags(existing.title, existing, input) });
    return c.json(serializeTodo(todo));
});

todos.put("/:id", zValidator("param", todoParamsSchema, validationResponse), zValidator("json", updateTodoSchema, validationResponse), async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const existing = await prisma.todo.findUnique({ where: { id }, select: { day: true, deletedAt: true, tags: true, tagMode: true } });
    if (!existing || existing.deletedAt !== null) return c.json({ errors: ["Todoが見つかりません"] }, 404);
    if (dateToKey(existing.day) < getTodayDateKey()) {
        return c.json({ errors: ["過去の日付のTodoは変更できません"] }, 409);
    }
    const { date, ...changes } = input;
    if (date && date < getTodayDateKey()) return c.json({ errors: ["過去の日付へは移動できません"] }, 409);
    if (date === getTodayDateKey()) await ensureCurrentDayPage();
    const todo = await prisma.$transaction(async (transaction) => {
        if (date) await transaction.todoDay.upsert({
            where: { date: dateKeyToDate(date) },
            create: { date: dateKeyToDate(date), activated: date === getTodayDateKey() },
            update: {}
        });
        return transaction.todo.update({ where: { id }, data: {
            ...changes, ...resolveTags(input.title, existing, input),
            ...(date && date !== dateToKey(existing.day) ? { day: dateKeyToDate(date), carriedOver: false } : {})
        } });
    });
    return c.json(serializeTodo(todo));
});

todos.delete("/:id", zValidator("param", todoParamsSchema, validationResponse), async (c) => {
    const { id } = c.req.valid("param");
    const existing = await prisma.todo.findUnique({ where: { id }, select: { day: true, deletedAt: true } });
    if (!existing) return c.json({ errors: ["Todoが見つかりません"] }, 404);
    if (existing.deletedAt !== null) return c.json({ errors: ["Todoが見つかりません"] }, 404);
    if (dateToKey(existing.day) < getTodayDateKey()) {
        return c.json({ errors: ["過去の日付のTodoは削除できません"] }, 409);
    }
    await prisma.todo.update({ where: { id }, data: { deletedAt: new Date() } });
    return c.body(null, 204);
});

todos.post("/:id/restore", zValidator("param", todoParamsSchema, validationResponse), async (c) => {
    const { id } = c.req.valid("param");
    const existing = await prisma.todo.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!existing || existing.deletedAt === null) return c.json({ errors: ["ゴミ箱のTodoが見つかりません"] }, 404);
    const todo = await prisma.todo.update({ where: { id }, data: { deletedAt: null } });
    return c.json(serializeTodo(todo));
});

todos.delete("/:id/force", zValidator("param", todoParamsSchema, validationResponse), async (c) => {
    const { id } = c.req.valid("param");
    const existing = await prisma.todo.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!existing || existing.deletedAt === null) return c.json({ errors: ["ゴミ箱のTodoが見つかりません"] }, 404);
    await prisma.todo.delete({ where: { id } });
    return c.body(null, 204);
});

todos.delete("/trash", async (c) => {
    await prisma.todo.deleteMany({ where: { deletedAt: { not: null } } });
    return c.body(null, 204);
});

export default todos;
