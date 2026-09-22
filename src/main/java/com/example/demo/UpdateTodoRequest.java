package com.example.demo;

import jakarta.validation.constraints.NotBlank;

public record UpdateTodoRequest(
        @NotBlank(message = "タイトルは必須です")
        String title,
        boolean done
) {
}