import { prisma } from "./prisma";

export function getTodayDateKey(): string {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function dateKeyToDate(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00.000Z`);
}

export function dateToKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export async function ensureDayPage(dateKey: string) {
    const day = dateKeyToDate(dateKey);

    return prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(71423019) IS NOT NULL AS locked`;

        const existing = await transaction.todoDay.findUnique({ where: { date: day } });
        if (existing) return existing;

        const page = await transaction.todoDay.create({ data: { date: day } });
        const previousPage = await transaction.todoDay.findFirst({
            where: { date: { lt: day } },
            orderBy: { date: "desc" }
        });

        if (previousPage) {
            const unfinishedTodos = await transaction.todo.findMany({
                where: { day: previousPage.date, done: false },
                select: { title: true }
            });

            if (unfinishedTodos.length > 0) {
                await transaction.todo.createMany({
                    data: unfinishedTodos.map(({ title }) => ({ title, done: false, day }))
                });
            }
        }

        return page;
    });
}

export function ensureCurrentDayPage() {
    return ensureDayPage(getTodayDateKey());
}