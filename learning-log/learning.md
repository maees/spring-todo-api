# 2026/08/29（土）学習記録

## 基礎を埋めて「仕組み」を理解する日

今日は、Linux・ターミナル操作を中心に学習した。

単にコマンドを暗記するのではなく、

> 「この記号を付けるとなぜこう動く？」

というところまで掘り下げて理解することを意識した。

---

## 1. Linux・ターミナル操作

### ディレクトリ操作

#### `cd`

ディレクトリを移動する。

```bash
cd ディレクトリ名
```

#### `cd -`

直前にいたディレクトリへ戻る。

```bash
cd -
```

#### `pwd`

現在いるディレクトリのパスを確認する。

```bash
pwd
```

---

## 2. ファイル作成

### `touch`

ファイルを作成する。

```bash
touch test.txt
```

複数のファイルもまとめて作成できる。

```bash
touch a.txt b.txt c.txt
```

---

## 3. ファイル検索

### `find`

ファイルやディレクトリを検索する。

`*` を使った検索について確認した。

```bash
find . -name "*a*"
```

### `*` の意味

`*` は「0文字以上の任意の文字列」を表す。

そのため、

```text
*a*
```

は、

```text
a
abc
cat
data
```

など、名前のどこかに `a` が含まれているものにマッチする。

「0文字以上」なので、`a` の前後に何もなくてもマッチする。

---

## 4. ディレクトリ構造の確認

### `tree`

ディレクトリやファイルの構造をツリー形式で確認する。

```bash
tree
```

---

## 5. `printf` とリダイレクト

以下のコマンドを実行した。

```bash
printf 'alpha\nbeta\n' > a.txt
```

### それぞれの意味

- `printf`
  - 文字列を出力する
- `\n`
  - 改行を表す
- `>`
  - 標準出力をファイルへリダイレクトする

結果として `a.txt` に、

```text
alpha
beta
```

が書き込まれる。

さらに、

```bash
printf 'gamma\n' > b.txt
```

を実行し、新しいファイルへ文字列を書き出す動きも確認した。

---

## 6. 標準出力・標準エラー

標準出力と標準エラーのリダイレクトについて実験した。

存在しないパスを指定して、

```bash
ls /not-found
```

を実行。

```text
ls: /not-found: No such file or directory
```

のようなエラーが発生することを確認した。

「正常な結果」と「エラー」は別の出力として扱われることを学んだ。

---

## 7. quoteの閉じ忘れ

quoteを閉じ忘れたことで、

```text
cmdand quote>
```

のような状態になる現象も経験した。

シェル側が、

「まだ文字列が終わっていない」

と判断して、続きを待っている状態になる。

---

# Git

Gitについて以下を整理した。

- remote repositoryとは何か
- `origin` とは何か
- GitHubのremote URLとの関係
- `main` との違い

特に、

```text
origin
↓
リモートリポジトリにつける名前

main
↓
ブランチ名
```

という違いを確認した。

---

# バックエンド全体の理解

個々の技術をバラバラに覚えるのではなく、

```text
HTTP
 ↓
Spring Boot
 ↓
PostgreSQL
 ↓
ネットワーク

＋ Git
＋ Docker / Kubernetes
```

のように、一つのバックエンドシステムの中で「それぞれ何を担当しているのか」を理解していく方針にした。

---

# Go Academyに向けて

現在学習しているJava / Spring Bootで、

- HTTP
- REST API
- Controller
- Service
- Repository
- DB
- Git
- Linux

など、バックエンド開発の基本を理解する。

その知識を土台にして、あとからGoで同じ概念を実装できるようにする。

```text
Java / Spring Bootでバックエンドの仕組みを理解
                ↓
        REST APIを作れる
                ↓
       DBとの連携を理解
                ↓
         Goで実装してみる
```

---

# Spring Boot Todo API開発記録

## Hello WorldからDocker・PostgreSQL・Service層まで

Spring Bootの学習では、最初から完成形を作るのではなく、APIがWebに表示される仕組みを一つずつ確認しながらTodo APIを育ててきた。

今回の大きな流れは、次のとおり。

```text
文字列を返すAPI
  ↓
TodoをJSONで返す
  ↓
メモリ上でCRUD
  ↓
PostgreSQLでCRUD
  ↓
Controller・Service・Repositoryに分割
```

## 1. Spring Bootを起動して、最初のAPIを作る

最初に作ったのは、文字列を返すだけのAPIだった。

```java
@GetMapping("/hello")
public String hello() {
    return "Hello Spring Boot";
}
```

ターミナルから次のコマンドでSpring Bootを起動した。

```bash
./gradlew bootRun
```

ログに次の行が表示されれば起動成功となる。

```text
Tomcat started on port 8080
Started DemoApplication
```

ブラウザや`curl`から`http://localhost:8080/hello`へアクセスすると、Spring Bootがリクエストを受け取り、`@GetMapping("/hello")`が付いたメソッドを探して戻り値を返す。

この段階で疑問に思ったのは、「どうしてWeb画面とターミナルの二つがあるのか」だった。

- ターミナルは、Spring Bootを動かし、処理やエラーのログを見る場所
- ブラウザや`curl`は、動いているSpring Bootへリクエストを送る側

つまり、ターミナル側が店員で、ブラウザや`curl`側がお客さんのような関係だった。

## 2. JSONでTodoを返す

次に、文字列だけでなくTodoのデータをJSONで返した。

```json
{"id":1,"title":"Spring Bootを学ぶ","done":false}
```

Javaの`Map`や`List`を戻り値にすると、Spring BootがJSONへ変換してHTTPレスポンスとして返してくれることを確認した。

ここでは「JSONの項目の順番がコードと違うのはなぜ？」という疑問も出た。JSONオブジェクトの項目順には基本的に意味がなく、受け取る側は順番ではなく`id`、`title`、`done`という名前で値を判断する。

## 3. GETとPOSTを作る

`GET /todos`で一覧を取得し、`POST /todos`で新しいTodoを受け取れるようにした。

```bash
curl -i -X POST http://localhost:8080/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"POSTを学ぶ","done":false}'
```

最初は`405 Method Not Allowed`が返ってきた。これはURL自体は存在するものの、その時点では`GET`だけがあり、`POST`を受け取る処理がなかったためだった。

`@PostMapping("/todos")`を追加すると、送ったJSONを`@RequestBody`でJavaのデータとして受け取れるようになった。

また、Todo作成時に利用者がIDを送らなくても、アプリ側で次のIDを決める処理を作った。これにより、利用者はタイトルと完了状態だけを送ればよくなった。

## 4. IDを使った取得・更新・削除

続いて、URLに含まれるIDを受け取るAPIを追加した。

```text
GET    /todos/1
PUT    /todos/1
DELETE /todos/1
```

`@PathVariable long id`は、`/todos/1`の`1`をJavaの`id`変数として受け取る役割を持つ。

取得では、IDが見つかれば`200 OK`とTodoを返し、存在しなければ`404 Not Found`を返した。

更新では、リクエストで受け取った`title`と`done`を使って、指定されたIDのTodoを書き換えた。

削除では、指定されたIDを消せた場合に`204 No Content`を返した。

```text
200 OK             処理成功。返すデータがある
204 No Content     処理成功。返す本文はない
400 Bad Request    送ったデータに問題がある
404 Not Found      対象が見つからない
405 Method Not Allowed そのHTTPメソッドには対応していない
500 Internal Server Error サーバー内部で処理に失敗した
```

ここで学んだのは、「IDをWeb側が返している」のではなく、利用者がURLの一部としてIDを指定し、Spring Bootがそれを受け取って対象のTodoを探しているということだった。

## 5. 同じURLとHTTPメソッドを二つ作るとエラーになる理由

学習中、似たControllerファイルを二つ作り、両方に同じ`@GetMapping`を書いたことで起動できなくなったことがあった。

ファイルが二つあること自体が問題なのではない。実際の開発ではControllerを機能ごとに複数ファイルへ分ける。

問題は、次のように同じ受付条件が重複することだった。

```text
GET /todos → メソッドA
GET /todos → メソッドB
```

Spring Bootから見ると、どちらへ渡すべきか一意に決められない。URLまたはHTTPメソッドが異なれば、Controllerファイルが複数あっても問題ない。

## 6. メモリ保存からPostgreSQL保存へ

最初のTodo一覧は、Javaの`ArrayList`に入れていた。

```text
Spring Bootを起動 → データがある
Spring Bootを停止 → メモリ上のデータが消える
```

そこで、データを残せるようにPostgreSQLへ移行した。

`TodoRepository`を作成し、`JdbcTemplate`からSQLを実行する構成に変更した。

```text
Spring Boot
  ↓ JdbcTemplate
SQL
  ↓
PostgreSQL
```

一覧取得では、次のSQLを実行している。

```sql
SELECT id, title, done FROM todos ORDER BY id;
```

取得した各行を`Todo`へ変換し、最後にSpring BootがJSONへ変換して返す。

`findById()`では、IDに一致するTodoが存在するか分からないため、`Optional<Todo>`を使った。値があればTodo、なければ空の`Optional`となり、それを`200`または`404`へ変換した。

## 7. DockerのPostgreSQLと接続する

PostgreSQLはDockerコンテナの中で動かした。

```bash
docker compose up -d
docker compose ps
```

DockerはPostgreSQLそのものではない。アプリを隔離して動かす環境を作る仕組みであり、その環境の中でPostgreSQLを起動している。

```text
Mac
├── Spring Boot
└── Docker
    └── PostgreSQLコンテナ
        └── tododb
```

Spring Bootの起動ログでは、次の表示からPostgreSQLへの接続成功を確認した。

```text
HikariPool-1 - Added connection org.postgresql.jdbc.PgConnection
HikariPool-1 - Start completed
```

さらに、PostgreSQLへ直接SQLを送り、保存されたデータを確認した。

```bash
docker compose exec db psql -U todo_user -d tododb \
  -c "SELECT id, title, done FROM todos;"
```

`POST`で追加したTodoがSQLの結果にも表示されたことで、「APIが返しただけ」ではなく「Docker内のPostgreSQLに保存された」と確認できた。

## 8. PostgreSQL版CRUDを完成させる

Repositoryへ次の処理を順番に実装した。

- `findAll()`：全件取得
- `findById(id)`：1件取得
- `create(request)`：追加
- `update(id, request)`：更新
- `deleteById(id)`：削除

削除時には、`HelloAPI`から`todoRepository.deleteById(id)`を呼んだものの、Repository側にメソッドが保存されておらず、コンパイルエラーになった。

```text
シンボル: メソッド deleteById(long)
場所: タイプTodoRepositoryの変数 todoRepository
```

このログは、次の順番で読むと原因を絞り込める。

```text
どのファイル？ → HelloAPI.java
何行目？       → 144行目
何がない？     → deleteById(long)
どこにない？   → TodoRepository
```

`BUILD FAILED`は失敗したという最終結果であり、本当の原因は、その少し上に表示される具体的なエラーだった。

Repositoryへ`deleteById()`を正しく追加して保存すると、`DELETE /todos/2`は`204 No Content`になり、その後の`GET /todos/2`は`404 Not Found`になった。これでDBからの削除まで確認できた。

## 9. Controller・Service・Repositoryに分ける

2026年9月6日、CRUD完成後に`TodoService`を追加した。

変更前は、ControllerがRepositoryを直接呼んでいた。

```text
HelloAPI → TodoRepository → PostgreSQL
```

変更後は、Serviceを間に置いた。

```text
curl・ブラウザ
      ↓ HTTP
HelloAPI（Controller）
      ↓
TodoService
      ↓
TodoRepository
      ↓ SQL
PostgreSQL
```

それぞれの担当は次のとおり。

- `HelloAPI`：HTTPリクエストを受け、HTTPレスポンスを返す
- `TodoService`：アプリ固有のルールや処理を担当する
- `TodoRepository`：SQLを実行してDBとやり取りする
- PostgreSQL：Todoデータを保存する

現在の`TodoService`はRepositoryの処理を呼び出すだけなので、APIの結果は変わらない。しかし、今後「タイトルを空にできない」などのルールをServiceへ追加できる構造になった。

変更後に`GET /todos`を実行し、次を確認した。

```text
HTTP/1.1 200
[{"id":1,"title":"DockerのPostgreSQLに保存する","done":false}]
```

画面上の結果は同じでも、内部では新しい経路を通っている。

## 今日やったこと

2026年9月6日は、次の作業を行った。

1. DockerでPostgreSQLコンテナを起動した
2. Spring BootからPostgreSQLへの接続を確認した
3. POSTでTodoをDBへ保存した
4. SQLを直接実行して、Docker内のDBに入ったことを確認した
5. PUTでDB上のTodoを更新した
6. DELETEでDB上のTodoを削除した
7. `deleteById()`が見つからないコンパイルエラーを読んで修正した
8. `TodoService`を追加した
9. ControllerからServiceを経由する構成へ変更した
10. `GET /todos`が`200 OK`になることを確認した
11. 変更をGitへコミットした

## 今日学んだこと

- DockerはDBではなく、PostgreSQLなどを隔離して動かせる環境である
- APIのレスポンスだけでなく、SQLでもDB保存を確認できる
- `JdbcTemplate`はJavaからSQLを実行する窓口である
- RepositoryはDB操作、Serviceはアプリのルール、ControllerはHTTPを担当する
- 同じ結果でも、内部構造を整理することで変更しやすいコードになる
- エラーログは`BUILD FAILED`だけでなく、ファイル名・行番号・見つからないメソッドを読む
- `204`は削除失敗ではなく、「成功したが返す本文がない」という意味である
- 過去のログと最新のログが混ざっている場合は、時刻と一番下の結果を見る

## 今日出た質問

- Dockerの中にPostgreSQLがあるのか
- Dockerは仮想環境を作れるからPostgreSQLも作れる、という理解でよいか
- DBデータがDockerに入ったことは、どこを見れば分かるのか
- `update()`の戻り値を`map(ResponseEntity::ok)`している部分は何をしているのか
- 最初にControllerを二つ作ったとき、なぜエラーになったのか
- `GET`を二つ書いていたということなのか
- `Started DemoApplication`はログのどこにあるのか
- `deleteById(long)`が見つからないことを、ログのどこから判断したのか
- Service層を追加したあと、本当に動いているか

これらの質問を通して、単にコマンドやコードを写すだけでなく、「どこから来たデータが、どの層を通り、どこへ保存され、どのログを見れば確認できるか」を追えるようになった。

## 現在地と次のステップ

現時点では、Spring Bootの基礎的なバックエンド開発を約70%まで進めた。

完了しているのは、REST API、CRUD、HTTPステータス、JSON、PostgreSQL、Docker、Controller・Service・Repositoryの分割、Git・GitHubである。

次は、Service層を本当に活用するための入力チェックへ進む。

```text
タイトルが正常 → DBへ保存
タイトルが空   → 400 Bad Request
```

その後は、エラー処理、自動テスト、古い学習用コードの整理、README更新という順番で仕上げる。
