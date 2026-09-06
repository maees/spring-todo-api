package com.example.demo;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

@Service
public class TodoService {

    private final TodoRepository todoRepository;

    public TodoService(TodoRepository todoRepository) {
        this.todoRepository = todoRepository;
    }

    public List<Todo> findAll() {
        return todoRepository.findAll();
    }

    public Optional<Todo> findById(long id) {
        return todoRepository.findById(id);
    }

    public Todo create(CreateTodoRequest request) {
        return todoRepository.create(request);
    }

    public Optional<Todo> update(long id, UpdateTodoRequest request) {
        return todoRepository.update(id, request);
    }

    public boolean deleteById(long id) {
        return todoRepository.deleteById(id);
    }
}