package com.example.demo;

public record UpdateTodoRequest(
        String title,
        boolean done
) {
}