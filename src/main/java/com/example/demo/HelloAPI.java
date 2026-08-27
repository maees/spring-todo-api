package com.example.demo;

import java.util.ArrayList;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloAPI {

    private final List<Todo> todos = new ArrayList<>(List.of(
        new Todo(1, "Spring Bootを学ぶ", false),
        new Todo(2, "APIを作る", false)
    ));

    @GetMapping("/hello")
    public String hello() {
        return "Hello Spring Boot";
    }

    @GetMapping("/hello2")
    public String hello2() {
        return "Hello Spring Boot2";
    }

    @GetMapping("/hello3")
    public String hello3() {
        return "Hello Spring Boot3";
    }

    @GetMapping("/todo")
    public Todo todo() {
        return new Todo(1, "Spring Bootを学ぶ", false);
    }

    @GetMapping("/todos")
    public List<Todo> todos() {
        return todos;
    }

    @PostMapping("/todos")
    public Todo createTodo(@RequestBody Todo newTodo) {
        todos.add(newTodo);
        return newTodo;
    }
}
