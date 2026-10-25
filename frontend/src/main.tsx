import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import type { Todo, TodoDaySummary, TodoFilter } from "./types";
import "./style.css";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json", ...options.headers },
        ...options
    });
    if (response.ok) return (response.status === 204 ? null : await response.json()) as T;
    const error: { errors?: string[] } = await response.json().catch(() => ({}));
    throw new Error(error.errors?.[0] || "処理に失敗しました。もう一度試してください。");
}

const filters: { value: TodoFilter; label: string }[] = [
    { value: "all", label: "すべて" },
    { value: "open", label: "未完了" },
    { value: "done", label: "完了" }
];

function getTokyoDateKey(): string {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const value = (type: string) => parts.find((part) => part.type === type)!.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatDay(dateKey: string): string {
    return new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short"
    }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

function formatTabDay(dateKey: string): string {
    const [year, month, day] = dateKey.split("-").map(Number);
    const weekday = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        weekday: "short"
    }).format(new Date(`${dateKey}T00:00:00.000Z`));
    return `${month}/${day}(${weekday})`;
}

function shiftMonth(monthKey: string, amount: number): string {
    const [year, month] = monthKey.split("-").map(Number);
    const shifted = new Date(Date.UTC(year, month - 1 + amount, 1));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function TodoApp() {
    const [dayState, setDayState] = useState(() => {
        const today = getTokyoDateKey();
        return { today, selected: today };
    });
    const [filter, setFilter] = useState<TodoFilter>("all");
    const [todos, setTodos] = useState<Todo[]>([]);
    const [availableDays, setAvailableDays] = useState<TodoDaySummary[]>([]);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(() => getTokyoDateKey().slice(0, 7));
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [title, setTitle] = useState("");
    const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);
    const [reload, setReload] = useState(0);
    const titleInput = useRef<HTMLInputElement>(null);
    const editInput = useRef<HTMLInputElement>(null);
    const editForm = useRef<HTMLFormElement>(null);
    const calendarCloseButton = useRef<HTMLButtonElement>(null);
    const calendarTrigger = useRef<HTMLButtonElement>(null);
    const wasCalendarOpen = useRef(false);
    const selectedDayTab = useRef<HTMLButtonElement>(null);
    const { today: todayDate, selected: selectedDate } = dayState;
    const isReadOnly = selectedDate !== todayDate;

    useEffect(() => {
        const timer = window.setInterval(() => {
            const nextToday = getTokyoDateKey();
            setDayState((current) => current.today === nextToday
                ? current
                : {
                    today: nextToday,
                    selected: current.selected === current.today ? nextToday : current.selected
                });
        }, 15_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        setEditingTodoId(null);
        setEditingTitle("");
    }, [todayDate]);

    useEffect(() => {
        if (calendarOpen) {
            calendarCloseButton.current?.focus();
        } else if (wasCalendarOpen.current) {
            calendarTrigger.current?.focus();
        }
        wasCalendarOpen.current = calendarOpen;
    }, [calendarOpen]);

    useEffect(() => {
        selectedDayTab.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }, [selectedDate, availableDays]);

    useEffect(() => {
        if (editingTodoId) {
            editInput.current?.focus();
            editInput.current?.select();
        }
    }, [editingTodoId]);

    useEffect(() => {
        if (!editingTodoId || savingEdit) return;

        const handleOutsidePointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && !editForm.current?.contains(event.target)) {
                setEditingTodoId(null);
                setEditingTitle("");
                setMessage("");
            }
        };

        document.addEventListener("pointerdown", handleOutsidePointerDown);
        return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
    }, [editingTodoId, savingEdit]);

    useEffect(() => {
        let active = true;
        const query = new URLSearchParams({ date: selectedDate });
        if (filter !== "all") query.set("done", String(filter === "done"));
        setLoading(true);
        setMessage("");

        request<Todo[]>(`/api/todos?${query}`)
            .then((data) => {
                if (active) setTodos(data);
            })
            .catch(() => {
                if (active) setMessage("Todoを読み込めませんでした。アプリが起動しているか確認してください。");
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [filter, reload, selectedDate]);

    useEffect(() => {
        let active = true;
        request<TodoDaySummary[]>("/api/days")
            .then((days) => {
                if (active) setAvailableDays(days);
            })
            .catch(() => {
                if (active) setMessage("過去の日付を読み込めませんでした。");
            });
        return () => {
            active = false;
        };
    }, [reload, todayDate]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMessage("");
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setMessage("Todoを入力してください。");
            titleInput.current?.focus();
            return;
        }

        try {
            await request<Todo>("/api/todos", {
                method: "POST",
                body: JSON.stringify({ title: trimmedTitle, done: false })
            });
            setTitle("");
            setReload((value) => value + 1);
            titleInput.current?.focus();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Todoを追加できませんでした。");
        }
    }

    async function handleToggle(todo: Todo) {
        setMessage("");
        try {
            await request<Todo>(`/api/todos/${todo.id}`, {
                method: "PUT",
                body: JSON.stringify({ title: todo.title, done: !todo.done })
            });
            setReload((value) => value + 1);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Todoを更新できませんでした。");
        }
    }

    async function handleEditSubmit(event: FormEvent<HTMLFormElement>, todo: Todo) {
        event.preventDefault();
        const trimmedTitle = editingTitle.trim();
        if (!trimmedTitle) {
            setMessage("Todoを入力してください。");
            editInput.current?.focus();
            return;
        }

        setMessage("");
        setSavingEdit(true);
        try {
            await request<Todo>(`/api/todos/${todo.id}`, {
                method: "PUT",
                body: JSON.stringify({ title: trimmedTitle, done: todo.done })
            });
            setEditingTodoId(null);
            setEditingTitle("");
            setReload((value) => value + 1);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Todoを更新できませんでした。");
        } finally {
            setSavingEdit(false);
        }
    }

    function cancelEdit() {
        setEditingTodoId(null);
        setEditingTitle("");
        setMessage("");
    }

    function selectDay(date: string) {
        setDayState((current) => ({ ...current, selected: date }));
        setCalendarOpen(false);
        setFilter("all");
        setEditingTodoId(null);
        setEditingTitle("");
        setMessage("");
    }

    async function handleDelete(todo: Todo) {
        if (!window.confirm(`「${todo.title}」を削除しますか？`)) return;
        setMessage("");
        try {
            await request<null>(`/api/todos/${todo.id}`, { method: "DELETE" });
            setReload((value) => value + 1);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Todoを削除できませんでした。");
        }
    }

    const total = todos.length;
    const done = todos.filter((todo) => todo.done).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    const [calendarYear, calendarMonthNumber] = calendarMonth.split("-").map(Number);
    const calendarDayCount = new Date(Date.UTC(calendarYear, calendarMonthNumber, 0)).getUTCDate();
    const calendarOffset = new Date(Date.UTC(calendarYear, calendarMonthNumber - 1, 1)).getUTCDay();
    const calendarCells = Array.from({ length: calendarOffset + calendarDayCount }, (_, index) =>
        index < calendarOffset ? null : index - calendarOffset + 1
    );
    const pagesByDate = new Map<string, TodoDaySummary>(availableDays.map((day) => [day.date, day]));
    const earliestPageMonth = availableDays.at(-1)?.date.slice(0, 7) ?? todayDate.slice(0, 7);
    const currentMonth = todayDate.slice(0, 7);
    const earliestCalendarMonth = shiftMonth(earliestPageMonth, -12);
    const latestCalendarMonth = shiftMonth(currentMonth, 12);
    const calendarMonthLabel = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "long"
    }).format(new Date(`${calendarMonth}-01T00:00:00.000Z`));

    return (
        <main className="app-shell">
            <section className="hero" aria-labelledby="page-title">
                <p className="eyebrow">BUN + HONO TODO</p>
                <h1 id="page-title">今日を、<br /><em>ひとつずつ。</em></h1>
                <p className="hero-copy">小さな完了を積み重ねよう。</p>
                <div className="shape shape-sun" aria-hidden="true" />
                <div className="shape shape-line" aria-hidden="true" />
            </section>

            <section className="todo-panel" aria-label="Todoの管理">
                <div className="archive-tabs" role="group" aria-label="日付のページ">
                    {availableDays.map((day) => (
                        <button
                            ref={day.date === selectedDate ? selectedDayTab : null}
                            className={`archive-tab${day.date === selectedDate ? " is-selected" : ""}`}
                            type="button"
                            key={day.date}
                            aria-pressed={day.date === selectedDate}
                            aria-label={`${formatDay(day.date)}${day.date === todayDate ? "、今日" : `、Todo ${day.todoCount}件`}`}
                            title={formatDay(day.date)}
                            onClick={() => selectDay(day.date)}
                        >
                            <span className="archive-tab-date">{formatTabDay(day.date)}</span>
                            <small>{day.date === todayDate ? "今日" : `${day.todoCount}件`}</small>
                        </button>
                    ))}
                </div>
                <button
                    ref={calendarTrigger}
                    className="calendar-open"
                    type="button"
                    aria-label="カレンダーを開く"
                    title="カレンダーを開く"
                    onClick={() => {
                        setCalendarMonth(selectedDate.slice(0, 7));
                        setCalendarOpen(true);
                    }}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v4m10-4v4M4 9h16M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <header className="panel-header">
                    <div>
                        <p className="date-label">{formatDay(selectedDate)}</p>
                        <h2>やること</h2>
                    </div>
                    <div
                        className="progress-ring"
                        role="img"
                        aria-label={`完了率 ${percent}パーセント`}
                        style={{ "--progress": `${percent}%` } as CSSProperties}
                    >
                        <span>{percent}%</span>
                    </div>
                </header>

                {isReadOnly ? (
                    <p className="archive-notice">過去の日付のページは閲覧専用です</p>
                ) : (
                    <form className="todo-form" onSubmit={handleSubmit}>
                        <label className="sr-only" htmlFor="todo-title">新しいTodo</label>
                        <input
                            ref={titleInput}
                            id="todo-title"
                            name="title"
                            type="text"
                            maxLength={255}
                            placeholder="新しいTodoを入力"
                            autoComplete="off"
                            required
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                        <button type="submit" className="add-button"><span aria-hidden="true">＋</span>追加</button>
                    </form>
                )}
                <p className="form-message" aria-live="polite">{message}</p>

                <div className="toolbar">
                    <div className="filters" role="group" aria-label="Todoの表示を絞り込む">
                        {filters.map(({ value, label }) => (
                            <button
                                key={value}
                                className={`filter-button${filter === value ? " is-active" : ""}`}
                                type="button"
                                aria-pressed={filter === value}
                                onClick={() => setFilter(value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <p className="count-label">{total}件</p>
                </div>

                {loading && <div className="loading" role="status">読み込み中…</div>}
                {!loading && total > 0 && (
                    <ul className="todo-list" aria-live="polite">
                        {todos.map((todo) => (
                            <li className={`todo-item${todo.done ? " is-done" : ""}`} key={todo.id}>
                                <button
                                    className="check-button"
                                    type="button"
                                    aria-pressed={todo.done}
                                    aria-label={`「${todo.title}」を${todo.done ? "未完了" : "完了"}にする`}
                                    disabled={isReadOnly || editingTodoId === todo.id}
                                    onClick={() => handleToggle(todo)}
                                >
                                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </button>
                                {editingTodoId === todo.id && !isReadOnly ? (
                                    <form ref={editForm} className="todo-edit-form" onSubmit={(event) => handleEditSubmit(event, todo)}>
                                        <input
                                            ref={editInput}
                                            className="todo-edit-input"
                                            type="text"
                                            aria-label={`「${todo.title}」のタイトルを編集`}
                                            maxLength={255}
                                            required
                                            value={editingTitle}
                                            onChange={(event) => setEditingTitle(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Escape") cancelEdit();
                                            }}
                                        />
                                        <button className="edit-save-button" type="submit" disabled={savingEdit}>保存</button>
                                        <button className="edit-cancel-button" type="button" disabled={savingEdit} onClick={cancelEdit}>キャンセル</button>
                                    </form>
                                ) : (
                                    <>
                                        {isReadOnly ? (
                                            <span className="todo-title">{todo.title}</span>
                                        ) : (
                                            <button
                                                className="todo-title todo-title-button"
                                                type="button"
                                                aria-label={`「${todo.title}」を編集する`}
                                                onClick={() => {
                                                    setEditingTodoId(todo.id);
                                                    setEditingTitle(todo.title);
                                                    setMessage("");
                                                }}
                                            >
                                                {todo.title}
                                            </button>
                                        )}
                                        <button
                                            className="delete-button"
                                            type="button"
                                            aria-label={`「${todo.title}」を削除する`}
                                            disabled={isReadOnly}
                                            onClick={() => handleDelete(todo)}
                                        >
                                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        </button>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                {!loading && total === 0 && (
                    <div className="empty-state">
                        <span className="empty-mark" aria-hidden="true">✓</span>
                        <h3>ここから始めよう</h3>
                        <p>上の入力欄から、最初のTodoを追加できます。</p>
                    </div>
                )}

                <footer className="panel-footer">
                    <p>{total === 0 ? "まだTodoはありません" : `${total}件中 ${done}件を完了しました`}</p>
                    <span>データはPostgreSQLに保存されます</span>
                </footer>
            </section>
            {calendarOpen && (
                <div className="calendar-overlay">
                    <button
                        className="calendar-backdrop"
                        type="button"
                        aria-label="カレンダーを閉じる"
                        onClick={() => setCalendarOpen(false)}
                    />
                    <section
                        className="calendar-sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="calendar-title"
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                setCalendarOpen(false);
                                return;
                            }
                            if (event.key !== "Tab") return;

                            const focusable = Array.from(
                                event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")
                            );
                            const first = focusable[0];
                            const last = focusable.at(-1);
                            if (!first || !last) return;
                            if (event.shiftKey && document.activeElement === first) {
                                event.preventDefault();
                                last.focus();
                            } else if (!event.shiftKey && document.activeElement === last) {
                                event.preventDefault();
                                first.focus();
                            }
                        }}
                    >
                        <header className="calendar-header">
                            <div>
                                <p>日付を選択</p>
                                <h2 id="calendar-title">{calendarMonthLabel}</h2>
                            </div>
                            <div className="calendar-controls">
                                <button
                                    className="calendar-nav"
                                    type="button"
                                    aria-label="前の月"
                                    disabled={calendarMonth <= earliestCalendarMonth}
                                    onClick={() => setCalendarMonth((month) => shiftMonth(month, -1))}
                                >
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </button>
                                <button
                                    className="calendar-nav"
                                    type="button"
                                    aria-label="次の月"
                                    disabled={calendarMonth >= latestCalendarMonth}
                                    onClick={() => setCalendarMonth((month) => shiftMonth(month, 1))}
                                >
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </button>
                                <button
                                    ref={calendarCloseButton}
                                    className="calendar-close"
                                    type="button"
                                    aria-label="カレンダーを閉じる"
                                    onClick={() => setCalendarOpen(false)}
                                >
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                                </button>
                            </div>
                        </header>
                        <div className="calendar-weekdays" aria-hidden="true">
                            {["日", "月", "火", "水", "木", "金", "土"].map((weekday) => <span key={weekday}>{weekday}</span>)}
                        </div>
                        <div className="calendar-grid">
                            {calendarCells.map((day, index) => {
                                if (day === null) return <span className="calendar-empty-day" key={`blank-${index}`} />;
                                const date = `${calendarMonth}-${String(day).padStart(2, "0")}`;
                                const page = pagesByDate.get(date);
                                const isToday = date === todayDate;
                                const isSelected = date === selectedDate;
                                const isFuture = date > todayDate;
                                return (
                                    <button
                                        className={`calendar-date${page ? " has-page" : ""}${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`}
                                        type="button"
                                        key={date}
                                        aria-label={`${formatDay(date)}${page ? `、Todo ${page.todoCount}件` : "、ページなし"}`}
                                        aria-pressed={isSelected}
                                        disabled={!page || isFuture}
                                        onClick={() => selectDay(date)}
                                    >
                                        <span>{day}</span>
                                        {page && <small>{page.todoCount}</small>}
                                    </button>
                                );
                            })}
                        </div>
                        <footer className="calendar-footer">
                            <span><i aria-hidden="true" />ページあり</span>
                            <button type="button" onClick={() => selectDay(todayDate)}>今日へ戻る</button>
                        </footer>
                    </section>
                </div>
            )}
        </main>
    );
}

createRoot(document.getElementById("root")!).render(<TodoApp />);