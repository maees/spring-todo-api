package com.example.demo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class CreateTodoRequestTest {

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "   "})
    void 不正なタイトルはエラーになる(String title) {
        try (ValidatorFactory factory =
                Validation.buildDefaultValidatorFactory()) {

            var request = new CreateTodoRequest(title, false);
            var errors = factory.getValidator().validate(request);

            assertEquals(1, errors.size());
            assertEquals(
                    "タイトルは必須です",
                    errors.iterator().next().getMessage()
            );
        }
    }

    // @Test
    // void 空タイトルはエラーになる() {
    //     try (ValidatorFactory factory =
    //             Validation.buildDefaultValidatorFactory()) {

    //         var request = new CreateTodoRequest("", false);
    //         var errors = factory.getValidator().validate(request);

    //         assertEquals(1, errors.size());
    //         assertEquals(
    //                 "タイトルは必須です",
    //                 errors.iterator().next().getMessage()
    //         );
    //     }
    // }

    @Test
    void 正しいタイトルはエラーにならない() {
        try (ValidatorFactory factory =
                Validation.buildDefaultValidatorFactory()) {

            var request = new CreateTodoRequest("Spring Bootを学ぶ", false);
            var errors = factory.getValidator().validate(request);

            assertTrue(errors.isEmpty());
        }
    }
}