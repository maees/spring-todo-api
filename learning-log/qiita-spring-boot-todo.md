---
title: Spring Boot初心者がTodo APIをDocker・PostgreSQL対応するまでに学んだこと
tags:
  - Java
  - SpringBoot
  - PostgreSQL
  - Docker
  - REST-API
private: false
updated_at: 2026-09-06
id: null
organization_url_name: null
slide: false
ignorePublish: false
---

# はじめに

Spring Bootを使い、Todoを管理するREST APIを作りました。

最初は`Hello Spring Boot`という文字列を返すだけでしたが、少しずつ機能を追加し、最終的にDockerで動かしたPostgreSQLへデータを保存できるようにしました。

この記事では、完成したコードだけでなく、途中で遭遇した`404`、`405`、`500`、コンパイルエラーから何を学んだかもまとめます。

今回作ったものの構成は次のとおりです。

```text
curl・ブラウザ
      ↓ HTTP
Controller（HelloAPI）
      ↓
Service（TodoService）
      ↓
Repository（TodoRepository）
      ↓ SQL
PostgreSQL（Dockerコンテナ）
```

# 1. 最初は文字列を返すだけだった

最初に作ったAPIは、次のようなものでした。

```java
@GetMapping("/hello")
public String hello() {
    return "Hello Spring Boot";
}
```

Spring Bootを起動します。

```bash
./gradlew bootRun
```

ログに以下が出れば起動成功です。

```text
Tomcat started on port 8080 (http)
Started DemoApplication
```

このとき、ターミナルとブラウザの役割を最初は混同していました。

- ターミナル：Spring Bootを動かし、ログを見る場所
- ブラウザや`curl`：Spring BootへHTTPリクエストを送る側

Spring Bootは8080番ポートで待機し、`/hello`へのGETリクエストが来ると、対応するメソッドを実行して文字列を返します。

# 2. TodoをJSONで返す

次に、TodoをJSONで返すAPIを作りました。

```json
{
  "id": 1,
  "title": "Spring Bootを学ぶ",
  "done": false
}
```

JavaのオブジェクトをControllerの戻り値にすると、Spring BootがJSONへ変換してHTTPレスポンスとして返してくれます。

JSONの項目がコードに書いた順番と違うこともありましたが、JSONオブジェクトでは基本的に項目順ではなく、`id`や`title`などの名前で値を判断します。

# 3. CRUD APIを作る

Todoに対して、次のAPIを作りました。

| HTTPメソッド | URL | 処理 |
|---|---|---|
| GET | `/todos` | 一覧取得 |
| GET | `/todos/{id}` | 1件取得 |
| POST | `/todos` | 新規作成 |
| PUT | `/todos/{id}` | 更新 |
| DELETE | `/todos/{id}` | 削除 |

例えば、POSTは次のように試せます。

```bash
curl -i -X POST http://localhost:8080/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"POSTを学ぶ","done":false}'
```

`@RequestBody`がJSONをJavaのオブジェクトとして受け取り、`@PathVariable`が`/todos/1`のようなURLからIDを受け取ります。

```java
@GetMapping("/todos/{id}")
public ResponseEntity<Todo> getTodo(@PathVariable long id) {
    return todoService.findById(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
}
```

ここで、IDはサーバーから勝手に送られてくるものではありません。利用者がURLにIDを指定し、Spring BootがそのIDを使ってTodoを探します。

# 4. HTTPステータスがエラー調査の手掛かりになった

開発中に、さまざまなHTTPステータスを実際に見ました。

| ステータス | 意味 | 今回の例 |
|---|---|---|
| `200 OK` | 処理成功 | Todoの取得・更新成功 |
| `204 No Content` | 成功したが返す本文はない | 削除成功 |
| `400 Bad Request` | リクエストに問題がある | 必要なJSON項目が足りない |
| `404 Not Found` | 対象が見つからない | 存在しないIDを取得 |
| `405 Method Not Allowed` | HTTPメソッドに未対応 | GETしかないURLへPOST |
| `500 Internal Server Error` | サーバー内部の処理失敗 | SQL実行時の問題 |

特に`204`は、最初は「何も返ってこないので失敗した？」と感じました。しかし実際は、「削除には成功したが、レスポンス本文は返さない」という正常な結果でした。

削除後に同じIDをGETし、`404`になることまで確認すると、本当に削除されたと判断できます。

# 5. 同じGETを二つ作ると、Spring Bootが迷う

途中でControllerファイルを二つ作り、その両方に同じマッピングを書いて起動エラーになりました。

```text
GET /todos → メソッドA
GET /todos → メソッドB
```

問題は「ファイルが二つあること」ではありません。実際の開発では、機能ごとにControllerを分割します。

問題なのは、URLとHTTPメソッドの組み合わせが重複し、Spring Bootがどちらを呼ぶか決められないことです。

# 6. 最初はメモリ上へ保存した

初期段階では、Todoを`ArrayList`へ保存していました。

この方法は仕組みを学ぶには分かりやすい一方、Spring Bootを停止すると追加したデータが消えます。

```text
Spring Bootを起動 → メモリ上にデータがある
Spring Bootを停止 → メモリ上のデータが消える
```

そこで、保存先をPostgreSQLへ変更しました。

# 7. DockerでPostgreSQLを動かす

Docker Composeを使い、PostgreSQLコンテナを起動しました。

```bash
docker compose up -d
docker compose ps
```

ここで理解した大事な点は、Docker自体がDBなのではないことです。

Dockerはアプリを隔離した環境で動かす仕組みで、そのコンテナの中でPostgreSQLが動いています。

```text
Mac
├── Spring Boot
└── Docker
    └── PostgreSQLコンテナ
        └── tododb
```

Spring Boot側には、PostgreSQLへ接続する設定を追加しました。

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/tododb
spring.datasource.username=${DB_USERNAME:todo_user}
spring.datasource.password=${DB_PASSWORD:todo_password}
spring.sql.init.mode=always
```

起動ログでは、次の行が接続成功の手掛かりになりました。

```text
HikariPool-1 - Added connection org.postgresql.jdbc.PgConnection
HikariPool-1 - Start completed
```

# 8. RepositoryからSQLを実行する

DB操作は`TodoRepository`へまとめ、`JdbcTemplate`を使ってSQLを実行しました。

```java
@Repository
public class TodoRepository {

    private final JdbcTemplate jdbcTemplate;

    public TodoRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }
}
```

一覧取得では、SQLの各行を`Todo`へ変換します。

```java
public List<Todo> findAll() {
    return jdbcTemplate.query(
            "SELECT id, title, done FROM todos ORDER BY id",
            (rs, rowNum) -> new Todo(
                    rs.getLong("id"),
                    rs.getString("title"),
                    rs.getBoolean("done")
            )
    );
}
```

削除では、SQLによって削除された行数を見て成功・失敗を判断します。

```java
public boolean deleteById(long id) {
    int deleted = jdbcTemplate.update(
            "DELETE FROM todos WHERE id = ?",
            id
    );
    return deleted > 0;
}
```

APIのレスポンスだけでなく、PostgreSQLへ直接問い合わせることで、データが本当にDBへ保存されたか確認しました。

```bash
docker compose exec db psql -U todo_user -d tododb \
  -c "SELECT id, title, done FROM todos;"
```

# 9. コンパイルエラーをどこから読むか

削除処理を追加したとき、次のコンパイルエラーが発生しました。

```text
HelloAPI.java:144: エラー: シンボルを見つけられません
boolean deleted = todoRepository.deleteById(id);
                                 ^
シンボル: メソッド deleteById(long)
場所: タイプTodoRepositoryの変数 todoRepository
```

このログは次の順番で読むと、原因を絞り込めます。

```text
どのファイル？ → HelloAPI.java
何行目？       → 144行目
何がない？     → deleteById(long)
どこにない？   → TodoRepository
```

原因は、Controllerが`deleteById(id)`を呼んでいるのに、保存済みの`TodoRepository.java`にはそのメソッドがなかったことでした。

ログ末尾の`BUILD FAILED`は失敗したという結果です。本当の原因を知るには、その少し上にあるファイル名、行番号、エラー内容を読む必要があります。

# 10. Service層を追加する

PostgreSQL版CRUDが動いたあと、`TodoService`を追加しました。

変更前は、ControllerがRepositoryを直接呼んでいました。

```text
HelloAPI → TodoRepository → PostgreSQL
```

変更後は、Serviceを間に置きました。

```text
HelloAPI → TodoService → TodoRepository → PostgreSQL
```

```java
@Service
public class TodoService {

    private final TodoRepository todoRepository;

    public TodoService(TodoRepository todoRepository) {
        this.todoRepository = todoRepository;
    }

    public List<Todo> findAll() {
        return todoRepository.findAll();
    }
}
```

現時点のServiceはRepositoryを呼ぶだけなので、利用者から見える結果は変わりません。

しかし、今後「タイトルを空にできない」「完了済みTodoには特別な処理をする」といったアプリ固有のルールを、HTTP処理やSQLから分離して書けるようになりました。

# 今日やったこと

2026年9月6日に行った作業です。

1. DockerでPostgreSQLを起動
2. Spring BootとPostgreSQLの接続を確認
3. POSTでTodoをDBへ保存
4. SQLを直接実行して保存結果を確認
5. PUTでDB上のTodoを更新
6. DELETEでDB上のTodoを削除
7. `deleteById(long)`が見つからないコンパイルエラーを調査・修正
8. `TodoService`を新規作成
9. ControllerからServiceを呼ぶ構成へ変更
10. `GET /todos`が`200 OK`になることを確認
11. 変更をGitへコミット

# 学んだこと

- HTTPリクエストがController、Service、Repositoryを通ってDBへ届く流れ
- DockerとPostgreSQLは同じものではないこと
- `JdbcTemplate`がJavaからSQLを実行する窓口であること
- APIの結果とSQLの両方から、DBの状態を確認できること
- Controller、Service、Repositoryで担当を分ける理由
- HTTPステータスから、どこまで処理できたか推測できること
- コンパイルエラーでは、ファイル名・行番号・見つからないもの・探した場所を読むこと
- 過去のログと最新ログが混ざった場合は、時刻と末尾の結果を見ること

# おわりに

今回の学習では、コードを動かすことだけでなく、次の点を言葉で説明できるようになってきました。

```text
データはどこから来たのか
どのクラスを通ったのか
どこに保存されたのか
成功・失敗をどの表示から判断したのか
```

次はService層に入力チェックを追加し、タイトルが空の場合に`400 Bad Request`を返す処理へ進みます。その後、自動テスト、古い学習用コードの整理、README更新まで行う予定です。
