import { resolveTags } from "./tags";
import { prisma } from "./prisma";

export function getTodayDateKey(now: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function dateKeyToDate(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00.000Z`);
}

export function dateToKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export async function ensureDayPage(dateKey: string, database: typeof prisma = prisma) {
    const day = dateKeyToDate(dateKey);

    return database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(71423019) IS NOT NULL AS locked`;

        const existing = await transaction.todoDay.findUnique({ where: { date: day } });
        if (existing?.activated) return existing;

        const page = existing
            ? await transaction.todoDay.update({ where: { date: day }, data: { activated: true } })
            : await transaction.todoDay.create({ data: { date: day } });
        const previousPage = await transaction.todoDay.findFirst({
            where: { date: { lt: day } },
            orderBy: { date: "desc" }
        });

        if (previousPage) {
            const unfinishedTodos = await transaction.todo.findMany({
                where: { day: previousPage.date, done: false, deletedAt: null },
                select: { title: true, important: true, tags: true, tagMode: true }
            });

            if (unfinishedTodos.length > 0) {
                await transaction.todo.createMany({
                    data: unfinishedTodos.map((todo) => ({
                        ...resolveTags(todo.title, todo),
                        title: todo.title,
                        done: false,
                        important: todo.important,
                        carriedOver: true,
                        day
                    }))
                });
            }
        }

        return page;
    });
}

export async function ensureCurrentDayPage() {
    const today = getTodayDateKey();
    const pending = await prisma.todoDay.findMany({
        where: { activated: false, date: { lte: dateKeyToDate(today) } },
        orderBy: { date: "asc" }
    });
    for (const page of pending) await ensureDayPage(dateToKey(page.date));
    return ensureDayPage(today);
}