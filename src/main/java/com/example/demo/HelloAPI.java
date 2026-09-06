package com.example.demo;

import java.util.ArrayList;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;

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

    // @GetMapping("/todos")
    // public List<Todo> todos() {
    //     return todos;
    // }

    @GetMapping("/todos")
    public List<Todo> todos(){
        return todoRepository.findAll();
    }

    @GetMapping("/todos/{id}")
    public ResponseEntity<Todo> getTodo(@PathVariable long id) {
        return todoRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // @PostMapping("/todos")
    // public Todo createTodo(@RequestBody Todo newTodo) {
    //     todos.add(newTodo);
    //     return newTodo;
    // }

    @PostMapping("/todos")
    public Todo createTodo(@RequestBody CreateTodoRequest request) {
        // long nextId = todos.stream()
        //         .mapToLong(Todo::id)
        //         .max()
        //         .orElse(0) + 1;

        // Todo newTodo = new Todo(
        //         nextId,
        //         request.title(),
        //         request.done()
        // );

        // todos.add(newTodo);
        // return newTodo;
        return todoRepository.create(request);
    }

    // @GetMapping("/todos/{id}")
    // public ResponseEntity<Todo> getTodo(@PathVariable long id) {
    //     return todos.stream()
    //             .filter(todo -> todo.id() == id)
    //             .findFirst()
    //             .map(ResponseEntity::ok)
    //             .orElseGet(() -> ResponseEntity.notFound().build());
    // }


    // @GetMapping("/todos/{id}")
    // public ResponseEntity<Todo> getTodo(@PathVariable long id) {
    //     return todos.stream()
    //             .filter(todo -> todo.id() == id)
    //             .findFirst()
    //             .map(ResponseEntity::ok)
    //             .orElseGet(() -> ResponseEntity.notFound().build());
    // }

    // @PutMapping("/todos/{id}")
    // public ResponseEntity<Todo> updateTodo(
    //         @PathVariable long id,
    //         @RequestBody UpdateTodoRequest request) {

    //     for (int i = 0; i < todos.size(); i++) {
    //         Todo todo = todos.get(i);
    //         if (todo.id() == id) {
    //             Todo updatedTodo = new Todo(
    //                     todo.id(),
    //                     request.title(),
    //                     request.done()
    //             );
    //             todos.set(i, updatedTodo);
    //             return ResponseEntity.ok(updatedTodo);
    //         }
    //     }
    //     return ResponseEntity.notFound().build();
    // }

    @PutMapping("/todos/{id}")
    public ResponseEntity<Todo> updateTodo(
            @PathVariable long id,
            @RequestBody UpdateTodoRequest request) {

        return todoRepository.update(id, request)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }


    // @DeleteMapping("/todos/{id}")
    // public ResponseEntity<Void> deleteTodo(@PathVariable long id) {
    //     boolean removed = todos.removeIf(todo -> todo.id() == id);

    //     return removed
    //             ? ResponseEntity.noContent().build()
    //             : ResponseEntity.notFound().build();   
    // }

    @DeleteMapping("/todos/{id}")
    public ResponseEntity<Void> deleteTodo(@PathVariable long id) {
        boolean deleted = todoRepository.deleteById(id);

        return deleted
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    private final TodoRepository todoRepository;

    public HelloAPI(TodoRepository todoRepository) {
        this.todoRepository = todoRepository;
    }

}
