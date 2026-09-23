package com.example.demo;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;


import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.util.Optional;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import java.util.List;

@WebMvcTest(HelloAPI.class)
@Import(ApiExceptionHandler.class)
class HelloAPITest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    TodoRepository todoRepository;

    @Test
    void 空タイトルの登録は400と理由を返す() throws Exception {
        mockMvc.perform(post("/todos")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title":"","done":false}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]")
                        .value("タイトルは必須です"));

        verifyNoInteractions(todoRepository);
    }
    @Test
    void 存在しないIDの取得は404を返す() throws Exception {
        when(todoRepository.findById(999L))
                .thenReturn(Optional.empty());

        mockMvc.perform(get("/todos/999"))
                .andExpect(status().isNotFound());

        verify(todoRepository).findById(999L);
    }

    // @Test
    // void 存在するIDの取得は200とTodoを返す() throws Exception {
    //     var todo = new Todo(1L, "Spring Bootを学ぶ", false);

    //     when(todoRepository.findById(1L))
    //             .thenReturn(Optional.of(todo));

    //     mockMvc.perform(get("/todos/1"))
    //             .andExpect(status().isOk())
    //             .andExpect(jsonPath("$.id").value(1))
    //             .andExpect(jsonPath("$.title").value("Spring Bootを学ぶ"))
    //             .andExpect(jsonPath("$.done").value(false));

    //     verify(todoRepository).findById(1L);
    // }

    @Test
    void 未完了を指定すると未完了の検索結果を返す() throws Exception {
        var todo = new Todo(1L, "未完了のTodo", false);

        when(todoRepository.findByDone(false))
                .thenReturn(List.of(todo));

        mockMvc.perform(get("/todos").param("done", "false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].done").value(false));

        verify(todoRepository).findByDone(false);
    }
}