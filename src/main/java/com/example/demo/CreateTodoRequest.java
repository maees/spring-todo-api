package com.example.demo;

public record CreateTodoRequest(
        String title,
        boolean done
) {
}