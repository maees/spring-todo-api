import { Hono } from "hono";
import todos from "./todos";

const app = new Hono();

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/todos", todos);

app.onError((error, c) => {
    console.error(error);
    return c.json({ errors: ["サーバー内部でエラーが発生しました"] }, 500);
});

const port = Number(Bun.env.PORT ?? 3000);
Bun.serve({ port, fetch: app.fetch });
console.log(`Hono API listening on http://localhost:${port}`);