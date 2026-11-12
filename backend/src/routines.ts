import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "./prisma";
import { dateKeyToDate, dateToKey, getTodayDateKey } from "./day-pages";

const routineSchema = z.object({
    title: z.string().trim().min(1, "タイトルは必須です").max(255, "タイトルは255文字以内で入力してください"),
    enabled: z.boolean().optional().default(true),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().default([]),
    intervalDays: z.number().int().min(1, "間隔は1日以上で指定してください").max(365, "間隔は365日以内で指定してください").optional().default(1),
    startDate: z.iso.date().optional()
});

const validationResponse = (
    result: { success: boolean; error?: { issues: { message: string }[] } },
    c: { json: (body: { errors: string[] }, status: 400) => Response }
) => {
    if (!result.success) {
        return c.json({ errors: result.error?.issues.map((issue) => issue.message) ?? [] }, 400);
    }
};

function toRoutine(routine: {
    id: string;
    title: string;
    enabled: boolean;
    daysOfWeek: string[];
    intervalDays: number;
    startDate: string | null;
    createdAt: Date;
}) {
    return {
        id: routine.id,
        title: routine.title,
        enabled: routine.enabled,
        daysOfWeek: routine.daysOfWeek.map((value) => Number(value)),
        intervalDays: routine.intervalDays,
        startDate: routine.startDate ?? dateToKey(routine.createdAt)
    };
}

export function isRoutineDue(
    routine: {
        enabled: boolean;
        daysOfWeek: string[];
        intervalDays: number;
        startDate: string | null;
        createdAt: Date;
    },
    dateKey: string
): boolean {
    if (!routine.enabled) return false;

    const anchorKey = routine.startDate ?? dateToKey(routine.createdAt);
    const daysSinceStart = Math.round(
        (dateKeyToDate(dateKey).getTime() - dateKeyToDate(anchorKey).getTime()) / 86_400_000
    );
    if (daysSinceStart < 0) return false;
    if (daysSinceStart % Math.max(1, routine.intervalDays) !== 0) return false;

    if (routine.daysOfWeek.length === 0) return true;
    const weekday = dateKeyToDate(dateKey).getUTCDay();
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
        if (!isRoutineDue(routine, dateKey)) continue;

        const existing = await database.routineHistory.findUnique({
            where: { routineId_dateKey: { routineId: routine.id, dateKey } }
        });
        if (existing) continue;

        const carriedOverTodo = await database.todo.findFirst({
            where: { day, title: routine.title, carriedOver: true, deletedAt: null }
        });
        const todo = carriedOverTodo ?? await database.todo.create({
            data: {
                title: routine.title,
                done: false,
                important: false,
                carriedOver: false,
                day,
                deletedAt: null
            }
        });

        await database.routineHistory.create({
            data: { routineId: routine.id, dateKey, todoId: todo.id }
        });

        if (!carriedOverTodo) created.push({ routineId: routine.id, todoId: todo.id.toString() });
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
            daysOfWeek: input.daysOfWeek.map(String),
            intervalDays: input.intervalDays,
            startDate: input.startDate ?? getTodayDateKey()
        }
    });
    return c.json(toRoutine(routine), 201);
});

routines.put("/:id", zValidator("json", routineSchema, validationResponse), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const existing = await prisma.routine.findUnique({ where: { id } });
    if (!existing) return c.json({ errors: ["ルーティンが見つかりません"] }, 404);

    const routine = await prisma.routine.update({
        where: { id },
        data: {
            title: input.title,
            enabled: input.enabled,
            daysOfWeek: input.daysOfWeek.map(String),
            intervalDays: input.intervalDays,
            ...(input.startDate ? { startDate: input.startDate } : {})
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
