const state = { filter: "all", todos: [] };
const todoList = document.querySelector("#todo-list");
const emptyState = document.querySelector("#empty-state");
const loading = document.querySelector("#loading");
const form = document.querySelector("#todo-form");
const titleInput = document.querySelector("#todo-title");
const formMessage = document.querySelector("#form-message");
const countLabel = document.querySelector("#count-label");
const summary = document.querySelector("#summary");
const progressRing = document.querySelector("#progress-ring");
const progressValue = document.querySelector("#progress-value");

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("ja-JP", { month:"long", day:"numeric", weekday:"short" }).format(new Date());

async function request(url, options = {}) {
    const response = await fetch(url, { headers:{ "Content-Type":"application/json", ...options.headers }, ...options });
    if (response.ok) return response.status === 204 ? null : response.json();
    const error = await response.json().catch(() => ({}));
    throw new Error(error.errors?.[0] || "処理に失敗しました。もう一度試してください。");
}

async function loadTodos() {
    loading.hidden = false;
    todoList.hidden = true;
    emptyState.hidden = true;
    const query = state.filter === "all" ? "" : `?done=${state.filter === "done"}`;
    try {
        state.todos = await request(`/todos${query}`);
        render();
    } catch (error) {
        formMessage.textContent = "Todoを読み込めませんでした。アプリが起動しているか確認してください。";
    } finally { loading.hidden = true; }
}

function render() {
    todoList.innerHTML = "";
    todoList.hidden = state.todos.length === 0;
    emptyState.hidden = state.todos.length !== 0;
    state.todos.forEach((todo) => todoList.append(createTodoItem(todo)));
    updateSummary();
}

function createTodoItem(todo) {
    const item = document.createElement("li");
    item.className = `todo-item${todo.done ? " is-done" : ""}`;
    const check = document.createElement("button");
    check.className = "check-button";
    check.type = "button";
    check.setAttribute("aria-pressed", String(todo.done));
    check.setAttribute("aria-label", `「${todo.title}」を${todo.done ? "未完了" : "完了"}にする`);
    check.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    check.addEventListener("click", () => toggleTodo(todo));
    const title = document.createElement("span");
    title.className = "todo-title";
    title.textContent = todo.title;
    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.type = "button";
    remove.setAttribute("aria-label", `「${todo.title}」を削除する`);
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    remove.addEventListener("click", () => deleteTodo(todo));
    item.append(check, title, remove);
    return item;
}

async function toggleTodo(todo) {
    try {
        await request(`/todos/${todo.id}`, { method:"PUT", body:JSON.stringify({ title:todo.title, done:!todo.done }) });
        await loadTodos();
    } catch (error) { formMessage.textContent = error.message; }
}

async function deleteTodo(todo) {
    if (!window.confirm(`「${todo.title}」を削除しますか？`)) return;
    try {
        await request(`/todos/${todo.id}`, { method:"DELETE" });
        await loadTodos();
    } catch (error) { formMessage.textContent = error.message; }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage.textContent = "";
    const title = titleInput.value.trim();
    if (!title) { formMessage.textContent = "Todoを入力してください。"; titleInput.focus(); return; }
    try {
        await request("/todos", { method:"POST", body:JSON.stringify({ title, done:false }) });
        titleInput.value = "";
        await loadTodos();
        titleInput.focus();
    } catch (error) { formMessage.textContent = error.message; }
});

document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
        state.filter = button.dataset.filter;
        document.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("is-active", item === button));
        loadTodos();
    });
});

function updateSummary() {
    const total = state.todos.length;
    const done = state.todos.filter((todo) => todo.done).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    countLabel.textContent = `${total}件`;
    progressValue.textContent = `${percent}%`;
    progressRing.style.setProperty("--progress", `${percent}%`);
    progressRing.setAttribute("aria-label", `完了率 ${percent}パーセント`);
    summary.textContent = total === 0 ? "まだTodoはありません" : `${total}件中 ${done}件を完了しました`;
}

loadTodos();
