# Todoアプリ

TypeScript 7を使ったReact + Viteの画面と、Bun上のHono APIで構成しています。DBアクセスはPrisma、保存先はPostgreSQL、API入力はZodで検証します。

## 機能

- Todoの一覧・詳細・作成・更新・削除
- 完了・未完了での絞り込み
- 日付が変わった後の未完了Todo引き継ぎ
- 日付タブとカレンダーから過去ページを閲覧（過去ページは閲覧専用）
- 全TodoのJSON/CSV書き出しと復元（追加・置き換え）
- 削除したTodoをゴミ箱に移動し、復元・完全削除・空にする
- 日毎・曜日指定のルーティンTodoを自動作成
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

続けて、保留中のmigrationを適用します。

```zsh
bun run db:deploy
```

空のPostgreSQLの場合はbaselineを省略し、`bun run db:deploy`を実行します。

各ページはAsia/Tokyoの日付で保存します。日付が変わった後の最初のアクセス時に新しいページを作り、直前のページの未完了Todoをコピーします。過去ページは画面から閲覧できますが、編集はできません。

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

画面上部の「今日・予定・記録」で切り替えます。
「予定」で未来の日付を選ぶと、その日の予定を登録・編集・削除できます。
Todoのタイトルまたは操作メニューの「編集・予定日を変更」から予定日を変更できます。
編集中の内容と追加欄の入力は、同じタブの下書きとして保持します。
「記録」では月を切り替えて完了数とその日のリストを確認できます。
タグは自動で付きます。未来の予定は当日になるまで今日の一覧に表示されません。
当日は予約した予定に加えて、前のページの未完了Todoを一度だけ引き継ぎます。
POST `/api/todos` は任意の `date`（`YYYY-MM-DD`、今日以降）を受け付け、省略時は今日に登録します。
過去のページは引き続き閲覧専用です（タグの修正は可能）。

```text
GET    /api/todos?done=true|false
GET    /api/todos?date=YYYY-MM-DD&done=true|false
GET    /api/todos/:id
GET    /api/days
POST   /api/todos
PUT    /api/todos/:id
DELETE /api/todos/:id
GET    /api/backup/export?format=json|csv
POST   /api/backup/import?format=json|csv&mode=merge|replace
GET    /api/health
```

POST/PUTのJSONは `title` と `done` を受け取ります。`title` は空文字不可、255文字以内です。

## バックアップと復元

画面フッターの「バックアップ / 復元」から、すべての日付ページとTodoをJSONまたはCSVで保存できます。CSVはExcelで開けるようBOM付きで出力します。

復元はファイルを選択し、次のどちらかを指定します。

- 追加（`mode=merge`）: 既存データを残し、同じ日付・タイトル・完了状態のTodoは重複させずに追加
- 置き換え（`mode=replace`）: 既存データをすべて削除してバックアップの内容に置き換え

## 確認

各アプリのディレクトリで実行します。

```zsh
bun run typecheck
```

BackendのユニットテストはPostgreSQLを起動せずに実行できます。

```zsh
cd backend
bun run test
```

Frontendのproduction build:

```zsh
cd frontend
bun run build
```

既存のJava/Spring Boot学習コードは `src/` に残しています。現在のTodoアプリは `backend/` と `frontend/` で起動します。

## 自動タグ

Todoとルーティンのタイトルから「仕事・生活・買い物・学習・健康」をキーワードで自動付与します。
複数に該当すれば複数付与し、該当しなければタグなしになります。外部APIへの送信はありません。
既存Todoも自動判定の対象です。判定ルールは `shared/tags.ts` で調整できます。

追加欄の下、Todoのタイトル編集画面、ルーティン編集画面でタグを変更できます。
タグを選び直すと手動設定になり、タイトル変更や翌日への引き継ぎでも保持します。
すべて外して「タグなし」にすることも、「自動で付ける」に戻すこともできます。
一覧の「タグで絞り込む」は完了状態のフィルターと組み合わせて使えます。
ルーティンのタグ変更は、以後に作成するTodoへ反映します。

APIのTodo／ルーティン作成・更新は、任意で `tags`（上記5種類の配列）と
`tagMode`（`auto` または `manual`）を受け取ります。`tags` のみの指定は手動設定です。
更新で両方を省略すると現在の方式を保持し、自動の場合だけタイトルから再判定します。
JSON／CSVバックアップにはTodoのタグと設定方式も含まれ、従来の3列CSVも読み込めます。
ルーティン定義自体は、従来どおりバックアップの対象外です。

更新後は `cd backend` で `bun run db:generate` と `bun run db:deploy` を実行してください。
