# Spring Boot Todo API

Spring Bootで作った、Todoを管理するシンプルなREST APIです。

## できること

- Todo一覧の取得
- Todoを1件取得
- Todoを新規作成
- Todoを更新
- Todoを削除

## 起動方法

Java 26とDockerを用意し、Dockerを起動しておきます。
以下はプロジェクトのフォルダで実行します。

まず、PostgreSQLを起動します。

```zsh
docker compose up -d db
```

続いて、Spring Bootを起動します。

```zsh
./gradlew bootRun
```

起動後、別のターミナルでTodo一覧を取得できます。

```zsh
curl -i http://localhost:8080/todos
```

## 使い方

Todo一覧を取得します。

```zsh
curl -i http://localhost:8080/todos
```

Todoを作成します。

```zsh
curl -i -X POST http://localhost:8080/todos -H 'Content-Type: application/json' -d '{"title":"APIを学ぶ","done":false}'
```

Todoを更新します。

```zsh
curl -i -X PUT http://localhost:8080/todos/1 -H 'Content-Type: application/json' -d '{"title":"Spring Bootを深く学ぶ","done":true}'
```

Todoを削除します。

```zsh
curl -i -X DELETE http://localhost:8080/todos/1
```


## データの保存

TodoはDockerで起動したPostgreSQLに保存しています。
Spring Bootを停止・再起動してもデータは残ります。
PostgreSQLのデータはDockerの名前付きボリュームで保持しています。

## テスト方法

入力チェックとControllerのテストを実行します。
この2つのテストは、DBやSpring Bootのサーバーを起動せずに実行できます。

```zsh
./gradlew test --tests "com.example.demo.CreateTodoRequestTest" --tests "com.example.demo.HelloAPITest"
```

確認する内容：

- 不正なタイトルを拒否する
- 正しいタイトルを受け付ける
- 空タイトルの登録で400とエラーメッセージを返す
- 存在しないIDの取得で404を返す
- 存在するIDの取得で200とTodoの内容を返す

Macでは、次のコマンドでテスト結果を開けます。

```zsh
open build/reports/tests/test/index.html
```