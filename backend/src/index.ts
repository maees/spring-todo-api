import { Hono } from "hono";
import todos from "./todos";
import { dateToKey, ensureCurrentDayPage } from "./day-pages";
import { prisma } from "./prisma";

const app = new Hono();

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.get("/api/days", async (c) => {
    await ensureCurrentDayPage();
    const pages = await prisma.todoDay.findMany({
        orderBy: { date: "desc" },
        include: { _count: { select: { todos: true } } }
    });
    return c.json(pages.map((page) => ({ date: dateToKey(page.date), todoCount: page._count.todos })));
});
app.route("/api/todos", todos);

app.onError((error, c) => {
    console.error(error);
    return c.json({ errors: ["サーバー内部でエラーが発生しました"] }, 500);
});

const port = Number(Bun.env.PORT ?? 3000);
Bun.serve({ port, fetch: app.fetch });
console.log(`Hono API listening on http://localhost:${port}`);