# Spring Boot Todo API

Spring Bootで作った、Todoを管理するシンプルなREST APIです。

## できること

- Todo一覧の取得
- Todoを1件取得
- Todoを新規作成
- Todoを更新
- Todoを削除

## 起動方法

```zsh
./gradlew bootRun

## API一覧

| メソッド | URL | 内容 |
| --- | --- | --- |
| GET | `/todos` | Todo一覧を取得 |
| GET | `/todos/{id}` | 1件取得 |
| POST | `/todos` | 新規作成 |
| PUT | `/todos/{id}` | 更新 |
| DELETE | `/todos/{id}` | 削除 |

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

## 注意

Todoはサーバーのメモリ上に保存しています。  
そのため、Spring Bootを停止・再起動するとデータは初期状態に戻ります。