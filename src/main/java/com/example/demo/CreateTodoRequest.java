package com.example.demo;

import jakarta.validation.constraints.NotBlank;


public record CreateTodoRequest(
        @NotBlank(message = "タイトルは必須です")
        String title,
        boolean done
) {
}