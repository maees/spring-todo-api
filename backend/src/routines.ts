import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "./prisma";
import { dateKeyToDate, dateToKey, getTodayDateKey } from "./day-pages";

const routineSchema = z.object({
    title: z.string().trim().min(1, "タイトルは必須です").max(255, "タイトルは255文字以内で入力してください"),
    enabled: z.boolean().optional().default(true),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().default([])
});

const validationResponse = (
    result: { success: boolean; error?: { issues: { message: string }[] } },
    c: { json: (body: { errors: string[] }, status: 400) => Response }
) => {
    if (!result.success) {
        return c.json({ errors: result.error?.issues.map((issue) => issue.message) ?? [] }, 400);
    }
};

function toRoutine(routine: { id: string; title: string; enabled: boolean; daysOfWeek: string[] }) {
    return {
        id: routine.id,
        title: routine.title,
        enabled: routine.enabled,
        daysOfWeek: routine.daysOfWeek.map((value) => Number(value))
    };
}

function isDue(routine: { enabled: boolean; daysOfWeek: string[] }, dateKey: string): boolean {
    if (!routine.enabled) return false;
    if (routine.daysOfWeek.length === 0) return true;
    const weekday = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
    return routine.daysOfWeek.includes(String(weekday));
}

export async function applyRoutines(dateKey: string = getTodayDateKey(), database: typeof prisma = prisma) {
    const day = dateKeyToDate(dateKey);
    await database.todoDay.upsert({
        where: { date: day },
        create: { date: day },
        update: {}
    });

    const routines = await database.routine.findMany({ where: { enabled: true } });
    const created = [];

    for (const routine of routines) {
        if (!isDue(routine, dateKey)) continue;

        const existing = await database.routineHistory.findUnique({
            where: { routineId_dateKey: { routineId: routine.id, dateKey } }
        });
        if (existing) continue;

        const todo = await database.todo.create({
            data: { title: routine.title, done: false, day, deletedAt: null }
        });

        await database.routineHistory.create({
            data: { routineId: routine.id, dateKey, todoId: todo.id }
        });

        created.push({ routineId: routine.id, todoId: todo.id.toString() });
    }

    return created;
}

const routines = new Hono();

routines.get("/", async (c) => {
    const items = await prisma.routine.findMany({ orderBy: { createdAt: "asc" } });
    return c.json(items.map(toRoutine));
});

routines.post("/", zValidator("json", routineSchema, validationResponse), async (c) => {
    const input = c.req.valid("json");
    const routine = await prisma.routine.create({
        data: {
            title: input.title,
            enabled: input.enabled,
            daysOfWeek: input.daysOfWeek.map(String)
        }
    });
    return c.json(toRoutine(routine), 201);
});

routines.put("/:id", async (c) => {
    const id = c.req.param("id");
    const input = routineSchema.parse(await c.req.json());
    const routine = await prisma.routine.update({
        where: { id },
        data: {
            title: input.title,
            enabled: input.enabled,
            daysOfWeek: input.daysOfWeek.map(String)
        }
    });
    return c.json(toRoutine(routine));
});

routines.delete("/:id", async (c) => {
    const id = c.req.param("id");
    await prisma.routine.delete({ where: { id } });
    return c.body(null, 204);
});

routines.post("/apply", async (c) => {
    const created = await applyRoutines(getTodayDateKey());
    return c.json({ created });
});

export default routines;
