package com.example.demo;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;


@Repository
public class TodoRepository {

    private final JdbcTemplate jdbcTemplate;

    public TodoRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

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

    public Todo create(CreateTodoRequest request) {
        return jdbcTemplate.queryForObject(
                "INSERT INTO todos (title, done) VALUES (?, ?) " +
                        "RETURNING id, title, done",
                (rs, rowNum) -> new Todo(
                        rs.getLong("id"),
                        rs.getString("title"),
                        rs.getBoolean("done")
                ),
                request.title(),
                request.done()
        );
    }
    public Optional<Todo> findById(long id) {
            List<Todo> results = jdbcTemplate.query(
                "SELECT id, title, done FROM todos WHERE id = ?",
                (rs, rowNum) -> new Todo(
                        rs.getLong("id"),
                        rs.getString("title"),
                        rs.getBoolean("done")
                ),
                id
            );

        return results.stream().findFirst();
    }
    public Optional<Todo> update(long id, UpdateTodoRequest request) {
        int updated = jdbcTemplate.update(
                "UPDATE todos SET title = ?, done = ? WHERE id = ?",
                request.title(),
                request.done(),
                id
        );

        if (updated == 0) {
            return Optional.empty();
        }

        return findById(id);
    }

    public boolean deleteById(long id) {
        int deleted = jdbcTemplate.update(
                "DELETE FROM todos WHERE id = ?",
                id
        );
        return deleted > 0;
    }



}
