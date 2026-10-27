import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "./prisma";
import { dateKeyToDate, dateToKey, getTodayDateKey } from "./day-pages";

const APP_ID = "daily-flow-todo";
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 5_000_000;
const MAX_TODOS = 100_000;

const todoSchema = z.object({
    title: z.string().trim().min(1, "タイトルは必須です").max(255, "タイトルは255文字以内で入力してください"),
    done: z.boolean()
});

const dateKeySchema = z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日付はYYYY-MM-DD形式で入力してください")
    .refine((value) => dateToKey(dateKeyToDate(value)) === value, "存在しない日付が含まれています");

const daySchema = z.object({
    date: dateKeySchema,
    todos: z.array(todoSchema)
});

const importSchema = z.object({
    version: z.literal(BACKUP_VERSION, "対応していないバックアップ形式です"),
    days: z.array(daySchema)
}).refine(
    (value) => value.days.reduce((total, day) => total + day.todos.length, 0) <= MAX_TODOS,
    `Todoは${MAX_TODOS}件以内にしてください`
);

export type BackupTodo = { title: string; done: boolean };
export type BackupDay = { date: string; todos: BackupTodo[] };
export type BackupFile = {
    app: string;
    version: number;
    exportedAt: string;
    days: BackupDay[];
};
export type NormalizedBackup = { version: number; days: BackupDay[] };
export type RestoreMode = "merge" | "replace";
export type RestoreResult = {
    mode: RestoreMode;
    daysRestored: number;
    daysCreated: number;
    todosCreated: number;
    todosSkipped: number;
};

function groupDays(days: BackupDay[]): NormalizedBackup {
    const grouped = new Map<string, BackupTodo[]>();

    for (const day of days) {
        const todos = grouped.get(day.date) ?? [];
        todos.push(...day.todos);
        grouped.set(day.date, todos);
    }

    return {
        version: BACKUP_VERSION,
        days: [...grouped.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([date, todos]) => ({ date, todos }))
    };
}

export function parseBackupJson(text: string): NormalizedBackup {
    let raw: unknown;
    try {
        raw = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
        throw new Error("JSONの形式が正しくありません");
    }

    const result = importSchema.safeParse(raw);
    if (!result.success) {
        throw new Error(result.error.issues[0]?.message ?? "バックアップの形式が正しくありません");
    }

    return groupDays(result.data.days);
}

function parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];

        if (quoted) {
            if (char !== '"') {
                field += char;
            } else if (text[index + 1] === '"') {
                field += '"';
                index += 1;
            } else {
                quoted = false;
            }
            continue;
        }

        if (char === '"') {
            quoted = true;
        } else if (char === ",") {
            row.push(field);
            field = "";
        } else if (char === "\n") {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else if (char !== "\r") {
            field += char;
        }
    }

    if (quoted) throw new Error("CSVの引用符が閉じられていません");

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

function parseDone(value: string, line: number): boolean {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "完了", "done"].includes(normalized)) return true;
    if (["false", "0", "未完了", "open"].includes(normalized)) return false;
    throw new Error(`${line}行目: doneはtrueまたはfalseで入力してください`);
}

export function parseBackupCsv(text: string): NormalizedBackup {
    const content = text.replace(/^\uFEFF/, "");
    const rows = parseCsvRows(content);

    if (rows.length === 0) throw new Error("CSVが空です");
    if (rows[0][0]?.trim().toLowerCase() === "date") rows.shift();
    if (rows.length === 0) throw new Error("復元するTodoがありません");

    const days: BackupDay[] = rows.map((row, index) => {
        const line = index + 2;

        if (row.length !== 3) {
            throw new Error(`${line}行目: date,title,doneの3列で入力してください`);
        }

        const [date, title, done] = row;
        const todo = todoSchema.safeParse({ title, done: parseDone(done, line) });
        if (!todo.success) {
            throw new Error(`${line}行目: ${todo.error.issues[0]?.message ?? "Todoの形式が正しくありません"}`);
        }

        const parsedDate = dateKeySchema.safeParse(date.trim());
        if (!parsedDate.success) {
            throw new Error(`${line}行目: ${parsedDate.error.issues[0]?.message ?? "日付の形式が正しくありません"}`);
        }

        return { date: parsedDate.data, todos: [todo.data] };
    });

    return groupDays(days);
}

function csvField(value: string): string {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toBackupCsv(backup: BackupFile): string {
    const lines = ["date,title,done"];

    for (const day of backup.days) {
        for (const todo of day.todos) {
            lines.push([day.date, csvField(todo.title), String(todo.done)].join(","));
        }
    }

    return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export async function loadBackup(database: typeof prisma = prisma): Promise<BackupFile> {
    const pages = await database.todoDay.findMany({
        orderBy: { date: "asc" },
        include: { todos: { orderBy: { id: "asc" } } }
    });

    return {
        app: APP_ID,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        days: pages.map((page) => ({
            date: dateToKey(page.date),
            todos: page.todos.map(({ title, done }) => ({ title, done }))
        }))
    };
}

function todoKey(todo: BackupTodo): string {
    return `${todo.done ? "1" : "0"}\u0000${todo.title}`;
}

export async function restoreBackup(
    backup: NormalizedBackup,
    mode: RestoreMode,
    database: typeof prisma = prisma
): Promise<RestoreResult> {
    return database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(71423020) IS NOT NULL AS locked`;

        if (mode === "replace") {
            await transaction.todoDay.deleteMany();
        }

        let daysCreated = 0;
        let todosCreated = 0;
        let todosSkipped = 0;

        for (const day of backup.days) {
            const date = dateKeyToDate(day.date);
            const existingPage = await transaction.todoDay.findUnique({ where: { date } });

            if (!existingPage) {
                await transaction.todoDay.create({ data: { date } });
                daysCreated += 1;
            }

            const existingTodos = mode === "merge" && existingPage
                ? await transaction.todo.findMany({
                    where: { day: date },
                    select: { title: true, done: true }
                })
                : [];
            const seen = new Set(existingTodos.map(todoKey));
            const toCreate = day.todos.filter((todo) => {
                const key = todoKey(todo);
                if (seen.has(key)) {
                    todosSkipped += 1;
                    return false;
                }
                seen.add(key);
                return true;
            });

            if (toCreate.length > 0) {
                await transaction.todo.createMany({
                    data: toCreate.map((todo) => ({ ...todo, day: date }))
                });
                todosCreated += toCreate.length;
            }
        }

        return {
            mode,
            daysRestored: backup.days.length,
            daysCreated,
            todosCreated,
            todosSkipped
        };
    });
}

const backup = new Hono();

backup.get("/export", async (c) => {
    const format = c.req.query("format") === "csv" ? "csv" : "json";
    const data = await loadBackup();
    const filename = `todos-${getTodayDateKey()}.${format}`;

    c.header("Content-Disposition", `attachment; filename="${filename}"`);

    if (format === "csv") {
        c.header("Content-Type", "text/csv; charset=utf-8");
        return c.body(toBackupCsv(data));
    }

    c.header("Content-Type", "application/json; charset=utf-8");
    return c.body(JSON.stringify(data, null, 2));
});

backup.post("/import", async (c) => {
    const format = c.req.query("format") === "csv" ? "csv" : "json";
    const mode: RestoreMode = c.req.query("mode") === "replace" ? "replace" : "merge";
    const body = await c.req.text();

    if (body.trim() === "") return c.json({ errors: ["ファイルが空です"] }, 400);
    if (body.length > MAX_BACKUP_BYTES) {
        return c.json({ errors: ["ファイルが大きすぎます（5MB以内）"] }, 400);
    }

    let parsed: NormalizedBackup;
    try {
        parsed = format === "csv" ? parseBackupCsv(body) : parseBackupJson(body);
    } catch (error) {
        return c.json({ errors: [error instanceof Error ? error.message : "ファイルを読み込めませんでした"] }, 400);
    }

    return c.json(await restoreBackup(parsed, mode));
});

export default backup;
