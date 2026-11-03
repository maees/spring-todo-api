import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { createRoot } from "react-dom/client";
import type { BackupResult, Todo, TodoDaySummary, TodoFilter, TrashTodo } from "./types";
import { request } from "./api";
import { ReviewModal } from "./ReviewModal";
import { RoutinePanel } from "./RoutinePanel";
import "./style.css";
import "./celebrate.css";
import "./review.css";
import "./dream-details.css";
import "./cafe-details.css";

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

function getTokyoHour(): number {
    return Number(new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        hourCycle: "h23"
    }).format(new Date()));
}

function shiftDateKey(dateKey: string, amount: number): string {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
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

function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>, close: () => void) {
    if (event.key === "Escape") {
        close();
        return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)')
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
}

function playCelebrate() {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const now = context.currentTime;
        const notes = [659.25, 783.99, 1046.5];
        notes.forEach((frequency, index) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = "triangle";
            oscillator.frequency.setValueAtTime(frequency, now + index * 0.08);
            gain.gain.setValueAtTime(0.0001, now + index * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.08 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.22);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(now + index * 0.08);
            oscillator.stop(now + index * 0.08 + 0.24);
        });
    } catch {
        // 音が鳴らなくても演出は続ける
    }
}

function CelebrateModal({ open, closing, onClose }: { open: boolean; closing: boolean; onClose: () => void }) {
    const confetti = useRef(
        Array.from({ length: 36 }, (_, index) => ({
            left: 50 + Math.cos((index / 36) * Math.PI * 2) * 38,
            top: 50 + Math.sin((index / 36) * Math.PI * 2) * 28,
            x: (Math.random() - 0.5) * 320,
            y: (Math.random() - 0.2) * 420,
            rotate: Math.random() * 720
        }))
    );

    useEffect(() => {
        if (open && !closing) playCelebrate();
    }, [open, closing]);

    if (!open) return null;

    return (
        <div className={`celebrate-overlay${closing ? " is-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
            <button className="celebrate-backdrop" type="button" aria-label="閉じる" onClick={onClose} />
            <div className="celebrate-stage">
                <div className="celebrate-burst" aria-hidden="true" />
                {confetti.current.map((piece, index) => (
                    <span
                        className="celebrate-confetti"
                        aria-hidden="true"
                        key={index}
                        style={{
                            left: `${piece.left}%`,
                            top: `${piece.top}%`,
                            "--x": `${piece.x}px`,
                            "--y": `${piece.y}px`,
                            "--r": `${piece.rotate}deg`
                        } as CSSProperties}
                    />
                ))}
                <h2 className="celebrate-title" id="celebrate-title">よくやった！<em>今日、全部完了</em></h2>
                <p className="celebrate-subtitle">小さな積み重ねが、大きな一歩になる</p>
                <button className="celebrate-good" type="button" onClick={onClose}>good</button>
            </div>
        </div>
    );
}


function RowActions({ todo, onPin, onDelete }: { todo: Todo; onPin: () => void; onDelete: () => void }) {
    const detailsRef = useRef<HTMLDetailsElement>(null);
    const close = (restoreFocus = false) => {
        if (detailsRef.current) {
            detailsRef.current.open = false;
            if (restoreFocus) detailsRef.current.querySelector("summary")?.focus();
        }
    };
    useEffect(() => {
        const outside = (event: PointerEvent) => {
            if (!detailsRef.current?.contains(event.target as Node)) close();
        };
        document.addEventListener("pointerdown", outside);
        return () => document.removeEventListener("pointerdown", outside);
    }, []);
    return (
        <details className="row-actions" ref={detailsRef}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}
            onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(true); } }}>
            <summary aria-label={`「${todo.title}」の操作`} title="項目の操作"><span aria-hidden="true">⋮</span></summary>
            <div className="row-actions-popover">
                <button type="button" onClick={() => { close(true); onPin(); }}>{todo.important ? "ピン留め解除" : "ピン留め"}</button>
                <button type="button" className="row-action-delete" onClick={() => { close(true); onDelete(); }}>削除</button>
            </div>
        </details>
    );
}

function UiIcon({ name }: { name: "settings" | "trash" | "backup" | "review" | "repeat" }) {
    const paths = {
        settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
        trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
        backup: "M12 15V3m-4 4 4-4 4 4M5 13v7h14v-7",
        review: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm3 4h8M8 12h8M8 16h5",
        repeat: "M17 3l3 3-3 3M20 6H8a5 5 0 0 0-5 5m4 10-3-3 3-3m-3 3h12a5 5 0 0 0 5-5"
    };
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

type Theme = "dream" | "cafe";

function TodoApp() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [theme, setTheme] = useState<Theme>(() => {
        try { return localStorage.getItem("todo-theme") === "cafe" ? "cafe" : "dream"; }
        catch { return "dream"; }
    });
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "cafe" ? "#214d3b" : "#c5b1dd");
        try { localStorage.setItem("todo-theme", theme); } catch { /* Theme still works when storage is unavailable. */ }
    }, [theme]);
    const [dayState, setDayState] = useState(() => {
        const today = getTokyoDateKey();
        return { today, selected: today };
    });
    const [filter, setFilter] = useState<TodoFilter>("all");
    const [todos, setTodos] = useState<Todo[]>([]);
    const [availableDays, setAvailableDays] = useState<TodoDaySummary[]>([]);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(() => getTokyoDateKey().slice(0, 7));
    const [backupOpen, setBackupOpen] = useState(false);
    const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
    const [importing, setImporting] = useState(false);
    const [backupMessage, setBackupMessage] = useState("");
    const [backupError, setBackupError] = useState(false);
    const [trashOpen, setTrashOpen] = useState(false);
    const [trashItems, setTrashItems] = useState<TrashTodo[]>([]);
    const [trashLoading, setTrashLoading] = useState(false);
    const [celebrateOpen, setCelebrateOpen] = useState(false);
    const [celebrateClosing, setCelebrateClosing] = useState(false);
    const [celebratedKey, setCelebratedKey] = useState<string | null>(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewClosing, setReviewClosing] = useState(false);
    const [reviewDate, setReviewDate] = useState(() => getTokyoDateKey());
    const [routineOpen, setRoutineOpen] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(() => {
        try { return localStorage.getItem("todo-sound") !== "off"; }
        catch { return true; }
    });
    const [nightTick, setNightTick] = useState(0);
    useEffect(() => {
        try { localStorage.setItem("todo-sound", soundEnabled ? "on" : "off"); } catch { /* Sound preference is optional. */ }
    }, [soundEnabled]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [title, setTitle] = useState("");
    const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);
    const [reload, setReload] = useState(0);
    const [deletedTodos, setDeletedTodos] = useState<Todo[]>([]);
    const [undoBusy, setUndoBusy] = useState(false);
    const [completion, setCompletion] = useState<{ id: string; key: number } | null>(null);
    useEffect(() => {
        if (!completion) return;
        const timer = window.setTimeout(() => setCompletion(null), 1100);
        return () => window.clearTimeout(timer);
    }, [completion]);
    const titleInput = useRef<HTMLInputElement>(null);
    const editInput = useRef<HTMLInputElement>(null);
    const editForm = useRef<HTMLFormElement>(null);
    const calendarCloseButton = useRef<HTMLButtonElement>(null);
    const calendarTrigger = useRef<HTMLButtonElement>(null);
    const wasCalendarOpen = useRef(false);
    const backupCloseButton = useRef<HTMLButtonElement>(null);
    const backupTrigger = useRef<HTMLButtonElement>(null);
    const wasBackupOpen = useRef(false);
    const trashCloseButton = useRef<HTMLButtonElement>(null);
    const trashTrigger = useRef<HTMLButtonElement>(null);
    const wasTrashOpen = useRef(false);
    const selectedDayTab = useRef<HTMLButtonElement>(null);
    const { today: todayDate, selected: selectedDate } = dayState;
    const isReadOnly = selectedDate !== todayDate;
    const previousToday = useRef(todayDate);

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
        const timer = window.setInterval(() => setNightTick((value) => value + 1), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        setEditingTodoId(null);
        setEditingTitle("");
    }, [todayDate]);

    useEffect(() => {
        if (!isReadOnly || selectedDate !== todayDate) return;
        const celebrateKey = `${todayDate}:all-done`;
        if (celebratedKey === celebrateKey) return;
        if (todos.length === 0) return;
        if (todos.every((todo) => todo.done)) {
            setCelebratedKey(celebrateKey);
            setCelebrateClosing(false);
            setCelebrateOpen(true);
        }
    }, [todos, isReadOnly, selectedDate, todayDate, celebratedKey]);

    function closeCelebrate() {
        setCelebrateClosing(true);
        window.setTimeout(() => {
            setCelebrateOpen(false);
            setCelebrateClosing(false);
        }, 250);
    }

    function openReview(date: string) {
        try { localStorage.setItem(`todo-review-auto:${date}`, "1"); } catch { /* Review still opens without storage. */ }
        setReviewDate(date);
        setReviewClosing(false);
        setReviewOpen(true);
    }

    function closeReview() {
        setReviewClosing(true);
        window.setTimeout(() => {
            setReviewOpen(false);
            setReviewClosing(false);
        }, 260);
    }

    useEffect(() => {
        if (backupOpen) {
            backupCloseButton.current?.focus();
        } else if (wasBackupOpen.current) {
            backupTrigger.current?.focus();
        }
        wasBackupOpen.current = backupOpen;
    }, [backupOpen]);

    useEffect(() => {
        if (trashOpen) {
            trashCloseButton.current?.focus();
            let active = true;
            setTrashLoading(true);
            request<TrashTodo[]>("/api/todos/trash")
                .then((data) => {
                    if (active) setTrashItems(data);
                })
                .catch(() => {
                    if (active) setMessage("ゴミ箱を読み込めませんでした。");
                })
                .finally(() => {
                    if (active) setTrashLoading(false);
                });
            return () => { active = false; };
        } else if (wasTrashOpen.current) {
            trashTrigger.current?.focus();
        }
        wasTrashOpen.current = trashOpen;
    }, [trashOpen]);

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

    useEffect(() => {
        if (previousToday.current === todayDate) return;
        const finishedDate = previousToday.current;
        const summary = availableDays.find((day) => day.date === finishedDate);
        if (!summary) return;
        previousToday.current = todayDate;
        if (summary.todoCount === 0) return;

        let alreadyReviewed = false;
        try { alreadyReviewed = localStorage.getItem(`todo-review-auto:${finishedDate}`) === "1"; }
        catch { /* Review can still open when storage is unavailable. */ }
        if (!alreadyReviewed) openReview(finishedDate);
    }, [todayDate, availableDays]);

    useEffect(() => {
        if (getTokyoHour() < 20) return;
        if (loading || reviewOpen || celebrateOpen || settingsOpen || calendarOpen || trashOpen || backupOpen || routineOpen || editingTodoId) return;
        if (todos.length > 0 && todos.every((todo) => todo.done)) return;

        const summary = availableDays.find((day) => day.date === todayDate);
        if (!summary || summary.todoCount === 0) return;

        let alreadyReviewed = false;
        try { alreadyReviewed = localStorage.getItem(`todo-review-auto:${todayDate}`) === "1"; }
        catch { /* Review can still open when storage is unavailable. */ }
        if (!alreadyReviewed) openReview(todayDate);
    }, [
        nightTick, loading, reviewOpen, celebrateOpen, settingsOpen, calendarOpen,
        trashOpen, backupOpen, routineOpen, editingTodoId, todos, availableDays, todayDate
    ]);

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
                body: JSON.stringify({ title: trimmedTitle, done: false, important: false })
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
                body: JSON.stringify({ title: todo.title, done: !todo.done, important: todo.important ?? false })
            });
            if (!todo.done) setCompletion({ id: todo.id, key: Date.now() });
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
                body: JSON.stringify({ title: trimmedTitle, done: todo.done, important: todo.important ?? false })
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
        setMessage("");
        try {
            await request<null>(`/api/todos/${todo.id}`, { method: "DELETE" });
            setDeletedTodos((current) => [...current.filter((item) => item.id !== todo.id), todo]);
            setReload((value) => value + 1);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Todoを削除できませんでした。");
        }
    }

    async function undoDelete() {
        const todo = deletedTodos[deletedTodos.length - 1];
        if (!todo || undoBusy) return;
        setUndoBusy(true);
        try {
            await request<Todo>(`/api/todos/${todo.id}/restore`, { method: "POST" });
            setDeletedTodos((current) => current.filter((item) => item.id !== todo.id));
            setTrashItems((current) => current.filter((item) => item.id !== todo.id));
            setReload((value) => value + 1);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "元に戻せませんでした。");
        } finally { setUndoBusy(false); }
    }

    async function toggleImportant(todo: Todo) {
        setMessage("");
        try {
            await request<Todo>(`/api/todos/${todo.id}`, {
                method: "PUT",
                body: JSON.stringify({ title: todo.title, done: todo.done, important: !(todo.important ?? false) })
            });
            setReload((value) => value + 1);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Todoを更新できませんでした。");
        }
    }

    async function restoreFromTrash(item: TrashTodo) {
        try {
            await request<Todo>(`/api/todos/${item.id}/restore`, { method: "POST" });
            setTrashItems((current) => current.filter((trash) => trash.id !== item.id));
            setReload((value) => value + 1);
            setMessage("Todoを元に戻しました。");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Todoを元に戻せませんでした。");
        }
    }

    async function forceDelete(item: TrashTodo) {
        if (!window.confirm(`「${item.title}」を完全に削除しますか？`)) return;
        try {
            await request<null>(`/api/todos/${item.id}/force`, { method: "DELETE" });
            setTrashItems((current) => current.filter((trash) => trash.id !== item.id));
            setMessage("Todoを完全に削除しました。");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Todoを完全に削除できませんでした。");
        }
    }

    async function emptyTrash() {
        if (!window.confirm("ゴミ箱を空にしますか？この操作は取り消せません。")) return;
        try {
            await request<null>("/api/todos/trash", { method: "DELETE" });
            setTrashItems([]);
            setMessage("ゴミ箱を空にしました。");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "ゴミ箱を空にできませんでした。");
        }
    }

    async function handleImport(file: File) {
        const format = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";

        if (importMode === "replace" && !window.confirm(
            "既存のTodoをすべて削除して、ファイルの内容に置き換えます。よろしいですか？"
        )) {
            return;
        }

        setImporting(true);
        setBackupMessage("");
        setBackupError(false);

        try {
            const result = await request<BackupResult>(
                `/api/backup/import?format=${format}&mode=${importMode}`,
                {
                    method: "POST",
                    headers: { "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json" },
                    body: await file.text()
                }
            );
            setReload((value) => value + 1);
            setBackupMessage(
                `${result.daysRestored}日分を読み込み、${result.todosCreated}件を追加しました`
                + (result.todosSkipped > 0 ? `（重複${result.todosSkipped}件はスキップ）` : "")
                + "。"
            );
        } catch (error) {
            setBackupError(true);
            setBackupMessage(error instanceof Error ? error.message : "復元できませんでした。");
        } finally {
            setImporting(false);
        }
    }

    const pagesByDate = new Map<string, TodoDaySummary>(availableDays.map((day) => [day.date, day]));
    const selectedSummary = pagesByDate.get(selectedDate);
    const total = selectedSummary?.todoCount ?? todos.length;
    const done = selectedSummary?.doneCount ?? todos.filter((todo) => todo.done).length;
    const percent = selectedSummary?.percent ?? (total === 0 ? 0 : Math.round((done / total) * 100));
    const carriedCount = selectedSummary?.carriedOverCount ?? todos.filter((todo) => todo.carriedOver).length;
    const [calendarYear, calendarMonthNumber] = calendarMonth.split("-").map(Number);
    const calendarDayCount = new Date(Date.UTC(calendarYear, calendarMonthNumber, 0)).getUTCDate();
    const calendarOffset = new Date(Date.UTC(calendarYear, calendarMonthNumber - 1, 1)).getUTCDay();
    const calendarCells = Array.from({ length: calendarOffset + calendarDayCount }, (_, index) =>
        index < calendarOffset ? null : index - calendarOffset + 1
    );
    const heatmapWeeks = 16;
    const todayWeekday = new Date(`${todayDate}T00:00:00.000Z`).getUTCDay();
    const heatmapStart = shiftDateKey(todayDate, -((heatmapWeeks - 1) * 7 + todayWeekday));
    const heatmapCells = Array.from({ length: heatmapWeeks * 7 }, (_, index) => {
        const date = shiftDateKey(heatmapStart, index);
        const summary = pagesByDate.get(date);
        const future = date > todayDate;
        const rate = summary?.percent ?? 0;
        const level = !summary || summary.doneCount === 0
            ? 0
            : rate >= 100
                ? 4
                : rate >= 70
                    ? 3
                    : rate >= 40
                        ? 2
                        : 1;
        return { date, summary, future, level };
    });
    const heatmapLabel = `${formatTabDay(heatmapStart)}〜${formatTabDay(todayDate)}`;
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
            <section className="hero" aria-label="ホーム">
                <h1 className="sr-only">今日のリスト</h1>
                {theme === "dream" ? (
                    <svg className="dream-sky" viewBox="0 0 110 112" fill="none" aria-hidden="true" focusable="false">
                        <path className="dream-moon" d="M73 12C57 13 47 27 51 42c4 16 24 23 37 12-17 1-29-14-23-29 2-5 5-9 8-13Z" />
                        <path className="dream-cloud dream-cloud-back" d="M39 70c-8-1-11-11-5-16 3-3 7-3 10-2 0-10 13-15 20-7 7-4 16 1 16 9 12-1 16 16 3 18H39Z" />
                        <path className="dream-cloud" d="M18 92C4 91 5 73 18 72c-1-14 19-20 26-8 9-6 21 0 21 11 15-2 19 17 4 19H18Z" />
                        <path className="dream-star" d="m24 18 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Zm66 58 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
                        <circle cx="92" cy="29" r="2" fill="#dba3ce" />
                        <circle cx="12" cy="53" r="2" fill="#9dcee6" />
                        <path d="m76 99 2 4 4 1-4 2-2 4-1-4-4-2 4-1 1-4Z" fill="#b7a0d6" />
                    </svg>
                ) : <div className="shape shape-sun" aria-hidden="true" />}
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
                    <div className="header-copy">
                        <p className="date-label">{formatDay(selectedDate)}</p>
                        <p className="day-stats" aria-live="polite">
                            <span>{selectedDate === todayDate ? "今日完了" : "完了"} <b>{done}</b> / 全体 <b>{total}</b></span>
                            <span className="day-stat-carry">引き継ぎ <b>{carriedCount}</b></span>
                        </p>
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

                <section className="habit-heatmap" aria-label={`直近${heatmapWeeks}週間の達成率`}>
                    <div className="heatmap-head">
                        <strong>積み重ね</strong>
                        <span>{heatmapLabel}</span>
                    </div>
                    <div className="heatmap-grid" role="list" aria-label="日ごとの完了数と達成率">
                        {heatmapCells.map((cell) => {
                            const label = cell.future
                                ? ""
                                : cell.summary
                                    ? `${formatDay(cell.date)}、${cell.summary.doneCount}/${cell.summary.todoCount}件完了、達成率${cell.summary.percent}%`
                                    : `${formatDay(cell.date)}、記録なし`;
                            return (
                                <span
                                    key={cell.date}
                                    className={`heatmap-cell${cell.future ? " is-future" : ""}${cell.date === todayDate ? " is-today" : ""}`}
                                    data-level={cell.level}
                                    role={cell.future ? undefined : "listitem"}
                                    aria-label={cell.future ? undefined : label}
                                    aria-hidden={cell.future ? "true" : undefined}
                                    title={cell.future ? undefined : label}
                                />
                            );
                        })}
                    </div>
                    <div className="heatmap-legend" aria-hidden="true">
                        <span>少ない</span>
                        {[0, 1, 2, 3, 4].map((level) => (
                            <i key={level} className="heatmap-cell" data-level={level} />
                        ))}
                        <span>多い</span>
                    </div>
                </section>

                {isReadOnly ? (
                    <p className="archive-notice" title="閲覧専用"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg><span className="sr-only">過去の日付のページは閲覧専用です</span></p>
                ) : (
                    <form className="todo-form" onSubmit={handleSubmit}>
                        <svg className="compose-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16-1 4 4-1L20 7l-3-3L5 16Zm10-10 3 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <label className="sr-only" htmlFor="todo-title">新しいTodo</label>
                        <input
                            ref={titleInput}
                            id="todo-title"
                            name="title"
                            type="text"
                            maxLength={255}
                            placeholder="追加する…"
                            autoComplete="off"
                            required
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                        <button type="submit" className="add-button" aria-label="追加" title="追加"><span aria-hidden="true">＋</span></button>
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
                                title={label}
                                onClick={() => setFilter(value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                </div>

                {loading && <div className="loading" role="status"><span className="loading-orbit" aria-hidden="true" /><span className="sr-only">読み込み中</span></div>}
                {!loading && total > 0 && (
                    <ul className="todo-list" aria-live="polite">
                        {todos.map((todo) => (
                            <li className={`todo-item${todo.done ? " is-done" : ""}${todo.important ? " is-important" : ""}`} key={todo.id}>
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
                                        {todo.important && <span className="pinned-mark" role="img" aria-label="ピン留め中"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5m6-9-1.5-1.5L14 9V4l1-1H9L10 4v5l-2.5 2.5L6 13Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
                                        {!isReadOnly && <RowActions todo={todo} onPin={() => { void toggleImportant(todo); }} onDelete={() => { void handleDelete(todo); }} />}
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                {!loading && total === 0 && (
                    <div className="empty-state">
                        <button className="empty-compose" type="button" aria-label="最初の項目を入力" onClick={() => titleInput.current?.focus()} disabled={isReadOnly}>
                            <svg viewBox="0 0 120 84" fill="none" aria-hidden="true"><rect x="20" y="8" width="80" height="68" rx="14" stroke="currentColor" strokeWidth="2" /><circle cx="38" cy="29" r="5" stroke="currentColor" strokeWidth="2" /><path d="M53 29h30M53 46h25M33 46h10M33 61h42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        </button>
                    </div>
                )}

                <footer className="panel-footer">
                    <p className="sr-only">{total}件中 {done}件完了</p>
                    <div className="footer-actions">
                        <button id="settings-trigger" className="backup-open" type="button" aria-expanded={settingsOpen} aria-controls="theme-settings" aria-label="設定" title="設定" onClick={() => setSettingsOpen(!settingsOpen)}><UiIcon name="settings" /></button>
                        <button
                            aria-label="ルーティン" title="ルーティン"
                            className="backup-open"
                            type="button"
                            onClick={() => setRoutineOpen(true)}
                        >
                            <UiIcon name="repeat" />
                        </button>
                        <button
                            aria-label="今日の振り返り" title="今日の振り返り"
                            className="backup-open"
                            type="button"
                            onClick={() => openReview(selectedDate)}
                        >
                            <UiIcon name="review" />
                        </button>
                        <button
                            ref={trashTrigger}
                            aria-label="ゴミ箱" title="ゴミ箱"
                            className="backup-open"
                            type="button"
                            onClick={() => setTrashOpen(true)}
                        >
                            <UiIcon name="trash" />
                        </button>
                        <button
                            ref={backupTrigger}
                            aria-label="バックアップと復元" title="バックアップと復元"
                            className="backup-open"
                            type="button"
                            onClick={() => {
                                setBackupMessage("");
                                setBackupError(false);
                                setBackupOpen(true);
                            }}
                        >
                            <UiIcon name="backup" />
                        </button>
                    </div>
                </footer>
                {settingsOpen && (
                    <section className="theme-settings" id="theme-settings" aria-labelledby="settings-title" onKeyDown={(event) => { if (event.key === "Escape") { setSettingsOpen(false); document.getElementById("settings-trigger")?.focus(); } }}>
                        <header className="settings-header">
                            <h3 id="settings-title">設定</h3>
                            <button type="button" className="settings-close" aria-label="設定を閉じる" onClick={() => { setSettingsOpen(false); document.getElementById("settings-trigger")?.focus(); }}>×</button>
                        </header>
                        <h4 id="theme-settings-title">きせかえ</h4>

                        <div className="theme-options">
                            {([
                                { id: "dream", name: "夢かわ", description: "星とパステルのふんわりカラー" },
                                { id: "cafe", name: "レトロ喫茶", description: "クリームと深緑の紙模様" }
                            ] as const).map((option) => (
                                <button key={option.id} type="button" className={`theme-option theme-option--${option.id}`} aria-pressed={theme === option.id} onClick={() => setTheme(option.id)}>
                                    <span className="theme-preview" aria-hidden="true"><i /><i /><i /></span>
                                    <strong>{option.name}{theme === option.id ? " ✓" : ""}</strong>

                                </button>
                            ))}
                        </div>
                        <p className="sr-only" role="status">{theme === "dream" ? "夢かわ" : "レトロ喫茶"}を選択中</p>
                        <label className="sound-setting">
                            <span>
                                <strong>振り返りの音</strong>
                                <small>夜の振り返りでやさしいチャイムを鳴らす</small>
                            </span>
                            <input
                                type="checkbox"
                                checked={soundEnabled}
                                onChange={(event) => setSoundEnabled(event.target.checked)}
                            />
                        </label>
                    </section>
                )}
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
                        onKeyDown={(event) => handleDialogKeyDown(event, () => setCalendarOpen(false))}
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
            {trashOpen && (
                <div className="calendar-overlay">
                    <button
                        className="calendar-backdrop"
                        type="button"
                        aria-label="ゴミ箱を閉じる"
                        onClick={() => setTrashOpen(false)}
                    />
                    <section
                        className="calendar-sheet backup-sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="trash-title"
                        onKeyDown={(event) => handleDialogKeyDown(event, () => setTrashOpen(false))}
                    >
                        <header className="calendar-header">
                            <div>
                                <p>データ管理</p>
                                <h2 id="trash-title">ゴミ箱</h2>
                            </div>
                            <div className="calendar-controls">
                                {trashItems.length > 0 && (
                                    <button
                                        className="trash-empty"
                                        type="button"
                                        onClick={() => void emptyTrash()}
                                    >
                                        ゴミ箱を空にする
                                    </button>
                                )}
                                <button
                                    ref={trashCloseButton}
                                    className="calendar-close"
                                    type="button"
                                    aria-label="ゴミ箱を閉じる"
                                    onClick={() => setTrashOpen(false)}
                                >
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                                </button>
                            </div>
                        </header>
                        {trashLoading ? (
                            <p className="trash-state">読み込み中...</p>
                        ) : trashItems.length === 0 ? (
                            <p className="trash-state">ゴミ箱は空です</p>
                        ) : (
                            <ul className="trash-list">
                                {trashItems.map((item) => (
                                    <li className="trash-item" key={item.id}>
                                        <div>
                                            <p className="trash-title">{item.title}</p>
                                            <p className="trash-meta">{item.date}・{item.done ? "完了" : "未完了"}</p>
                                        </div>
                                        <div className="trash-actions">
                                            <button type="button" onClick={() => void restoreFromTrash(item)}>元に戻す</button>
                                            <button type="button" className="is-danger" onClick={() => void forceDelete(item)}>完全に削除</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            )}
            {backupOpen && (
                <div className="calendar-overlay">
                    <button
                        className="calendar-backdrop"
                        type="button"
                        aria-label="バックアップを閉じる"
                        onClick={() => setBackupOpen(false)}
                    />
                    <section
                        className="calendar-sheet backup-sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="backup-title"
                        onKeyDown={(event) => handleDialogKeyDown(event, () => setBackupOpen(false))}
                    >
                        <header className="calendar-header">
                            <div>
                                <p>データ管理</p>
                                <h2 id="backup-title">バックアップと復元</h2>
                            </div>
                            <div className="calendar-controls">
                                <button
                                    ref={backupCloseButton}
                                    className="calendar-close"
                                    type="button"
                                    aria-label="バックアップを閉じる"
                                    onClick={() => setBackupOpen(false)}
                                >
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                                </button>
                            </div>
                        </header>
                        <section className="backup-section">
                            <h3>書き出す</h3>
                            <p>すべての日付ページとTodoをファイルに保存します。</p>
                            <div className="backup-actions">
                                <a className="backup-action" href="/api/backup/export?format=json" download>JSONで保存</a>
                                <a className="backup-action" href="/api/backup/export?format=csv" download>CSVで保存</a>
                            </div>
                        </section>
                        <section className="backup-section">
                            <h3>復元する</h3>
                            <p>JSONまたはCSVファイルを選択してください。</p>
                            <label className={`backup-file${importing ? " is-disabled" : ""}`}>
                                {importing ? "読み込み中..." : "ファイルを選択"}
                                <input
                                    className="sr-only"
                                    type="file"
                                    accept=".json,.csv,application/json,text/csv"
                                    disabled={importing}
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        event.target.value = "";
                                        if (file) void handleImport(file);
                                    }}
                                />
                            </label>
                            <fieldset className="backup-modes">
                                <legend>復元方法</legend>
                                <label>
                                    <input
                                        type="radio"
                                        name="import-mode"
                                        value="merge"
                                        checked={importMode === "merge"}
                                        onChange={() => setImportMode("merge")}
                                    />
                                    追加（同じTodoはスキップ）
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="import-mode"
                                        value="replace"
                                        checked={importMode === "replace"}
                                        onChange={() => setImportMode("replace")}
                                    />
                                    置き換え（既存をすべて削除）
                                </label>
                            </fieldset>
                            {backupMessage && (
                                <p className={`backup-message${backupError ? " is-error" : ""}`} role="status">
                                    {backupMessage}
                                </p>
                            )}
                        </section>
                    </section>
                </div>
            )}
            {completion && (
                <div key={completion.key} className={`completion-flash completion-flash--${theme}`} role="status">
                    <span aria-hidden="true">{theme === "dream" ? "✧ ✦ ✧" : "✓"}</span>
                    <span className="sr-only">完了しました</span>
                </div>
            )}
            {deletedTodos.length > 0 && (
                <div className="undo-toast">
                    <span role="status">{deletedTodos.length === 1 ? "削除しました" : `${deletedTodos.length}件削除しました`}</span>
                    <button type="button" disabled={undoBusy} onClick={() => void undoDelete()}>元に戻す</button>
                    <button type="button" className="undo-dismiss" aria-label="通知を閉じる" disabled={undoBusy} onClick={() => setDeletedTodos([])}>×</button>
                </div>
            )}
            <RoutinePanel
                open={routineOpen}
                onClose={() => setRoutineOpen(false)}
                onChanged={() => setReload((value) => value + 1)}
            />
            <ReviewModal
                open={reviewOpen}
                closing={reviewClosing}
                dateKey={reviewDate}
                dateLabel={formatDay(reviewDate)}
                isToday={reviewDate === todayDate}
                soundEnabled={soundEnabled}
                onClose={closeReview}
            />
            <CelebrateModal open={celebrateOpen} closing={celebrateClosing} onClose={closeCelebrate} />
        </main>
    );
}

createRoot(document.getElementById("root")!).render(<TodoApp />);
