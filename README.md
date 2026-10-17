# Todoアプリ

TypeScript 7を使ったReact + Viteの画面と、Bun上のHono APIで構成しています。DBアクセスはPrisma、保存先はPostgreSQL、API入力はZodで検証します。

## 機能

- Todoの一覧・詳細・作成・更新・削除
- 完了・未完了での絞り込み
- 入力値の検証とエラー応答

## 起動

Bun 1.4以降とDockerを用意し、プロジェクトのルートでPostgreSQLを起動します。

```zsh
docker compose up -d db
```

初回はbackendの設定と依存関係、Prisma Clientを準備します。

```zsh
cd backend
cp .env.example .env
bun install
bun run db:generate
```

既存のSpring Boot用PostgreSQLデータを使う場合は、初回のみmigration履歴を登録します。既存Todoの行は変更しません。

```zsh
bun run db:baseline
```

空のPostgreSQLを使う場合は、代わりにmigrationを適用します。

```zsh
bun run db:deploy
```

別のターミナルでAPIを起動します。

```zsh
cd backend
bun run dev
```

さらに別のターミナルでReact画面を起動します。

```zsh
cd frontend
bun install
bun run dev
```

画面は [http://localhost:5173](http://localhost:5173)、APIは `http://localhost:3000/api` です。ViteがAPIリクエストをHonoへ転送します。

## API

```text
GET    /api/todos?done=true|false
GET    /api/todos/:id
POST   /api/todos
PUT    /api/todos/:id
DELETE /api/todos/:id
GET    /api/health
```

POST/PUTのJSONは `title` と `done` を受け取ります。`title` は空文字不可、255文字以内です。

## 確認

各アプリのディレクトリで実行します。

```zsh
bun run typecheck
```

Frontendのproduction build:

```zsh
cd frontend
bun run build
```

既存のJava/Spring Boot学習コードは `src/` に残しています。現在のTodoアプリは `backend/` と `frontend/` で起動します。
