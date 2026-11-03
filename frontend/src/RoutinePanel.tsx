import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { request } from "./api";
import type { Routine } from "./types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const INTERVAL_OPTIONS = [
    { value: 1, label: "毎日" },
    { value: 2, label: "2日ごと" },
    { value: 3, label: "3日ごと" },
    { value: 7, label: "1週間ごと" },
    { value: 14, label: "隔週" },
    { value: 30, label: "30日ごと" }
];

function intervalLabel(routine: Routine): string {
    if (routine.intervalDays === 1) return routine.daysOfWeek.length === 0 ? "毎日" : "毎週";
    if (routine.intervalDays === 7) return "1週間ごと";
    if (routine.intervalDays === 14) return "隔週";
    return `${routine.intervalDays}日ごと`;
}

function describeRoutine(routine: Routine): string {
    const base = intervalLabel(routine);
    if (routine.daysOfWeek.length === 0) return base;
    const days = routine.daysOfWeek.map((day) => WEEKDAYS[day]).join("・");
    return routine.intervalDays === 1 ? `毎週 ${days}` : `${base}・${days}`;
}

function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>, close: () => void) {
    if (event.key === "Escape") {
        close();
        return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)")
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

type RoutinePanelProps = {
    open: boolean;
    onClose: () => void;
    onChanged: () => void;
};

export function RoutinePanel({ open, onClose, onChanged }: RoutinePanelProps) {
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [intervalDays, setIntervalDays] = useState(1);
    const [days, setDays] = useState<number[]>([]);
    const closeButton = useRef<HTMLButtonElement>(null);

    async function loadRoutines() {
        setLoading(true);
        try {
            setRoutines(await request<Routine[]>("/api/routines"));
        } catch {
            setMessage("ルーティンを読み込めませんでした。");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!open) return;
        setMessage("");
        void loadRoutines();
        window.setTimeout(() => closeButton.current?.focus(), 80);
    }, [open]);

    function resetForm() {
        setEditingId(null);
        setTitle("");
        setIntervalDays(1);
        setDays([]);
    }

    function beginEdit(routine: Routine) {
        setEditingId(routine.id);
        setTitle(routine.title);
        setIntervalDays(routine.intervalDays);
        setDays(routine.daysOfWeek);
        setMessage("");
    }

    function toggleDay(day: number) {
        setDays((current) => current.includes(day)
            ? current.filter((value) => value !== day)
            : [...current, day].sort((left, right) => left - right));
    }

    async function applyNow() {
        try {
            await request<{ created: unknown[] }>("/api/routines/apply", { method: "POST" });
            onChanged();
        } catch {
            setMessage("今日のルーティンを反映できませんでした。");
        }
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) {
            setMessage("ルーティン名を入力してください。");
            return;
        }

        setSaving(true);
        setMessage("");
        try {
            if (editingId) {
                const current = routines.find((routine) => routine.id === editingId);
                await request<Routine>(`/api/routines/${editingId}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        title: trimmed,
                        enabled: current?.enabled ?? true,
                        daysOfWeek: days,
                        intervalDays
                    })
                });
                setMessage("ルーティンを更新しました。");
            } else {
                await request<Routine>("/api/routines", {
                    method: "POST",
                    body: JSON.stringify({
                        title: trimmed,
                        enabled: true,
                        daysOfWeek: days,
                        intervalDays
                    })
                });
                setMessage("ルーティンを追加しました。");
            }
            resetForm();
            await loadRoutines();
            await applyNow();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "ルーティンを保存できませんでした。");
        } finally {
            setSaving(false);
        }
    }

    async function toggleRoutine(routine: Routine) {
        setMessage("");
        try {
            await request<Routine>(`/api/routines/${routine.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    title: routine.title,
                    enabled: !routine.enabled,
                    daysOfWeek: routine.daysOfWeek,
                    intervalDays: routine.intervalDays
                })
            });
            await loadRoutines();
            if (!routine.enabled) await applyNow();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "ルーティンを更新できませんでした。");
        }
    }

    async function deleteRoutine(routine: Routine) {
        if (!window.confirm(`「${routine.title}」を削除しますか？`)) return;
        setMessage("");
        try {
            await request<null>(`/api/routines/${routine.id}`, { method: "DELETE" });
            if (editingId === routine.id) resetForm();
            await loadRoutines();
            setMessage("ルーティンを削除しました。");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "ルーティンを削除できませんでした。");
        }
    }

    if (!open) return null;

    return (
        <div className="calendar-overlay">
            <button className="calendar-backdrop" type="button" aria-label="ルーティンを閉じる" onClick={onClose} />
            <section
                className="calendar-sheet routine-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="routine-title"
                onKeyDown={(event) => handleDialogKeyDown(event, onClose)}
            >
                <header className="calendar-header">
                    <div>
                        <p>くり返し</p>
                        <h2 id="routine-title">ルーティン</h2>
                    </div>
                    <div className="calendar-controls">
                        <button
                            ref={closeButton}
                            className="calendar-close"
                            type="button"
                            aria-label="ルーティンを閉じる"
                            onClick={onClose}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                        </button>
                    </div>
                </header>

                <form className="routine-form" onSubmit={handleSubmit}>
                    <label className="routine-field">
                        <span>{editingId ? "ルーティンを編集" : "新しいルーティン"}</span>
                        <input
                            type="text"
                            maxLength={255}
                            placeholder="例: ストレッチ"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </label>
                    <div className="routine-schedule">
                        <label className="routine-field routine-field--interval">
                            <span>間隔</span>
                            <select value={intervalDays} onChange={(event) => setIntervalDays(Number(event.target.value))}>
                                {INTERVAL_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                        <div className="routine-days" role="group" aria-label="曜日を指定">
                            <span>曜日（任意）</span>
                            <div className="routine-day-buttons">
                                {WEEKDAYS.map((label, day) => (
                                    <button
                                        key={label}
                                        className={days.includes(day) ? "is-active" : ""}
                                        type="button"
                                        aria-pressed={days.includes(day)}
                                        onClick={() => toggleDay(day)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="routine-form-actions">
                        {editingId && (
                            <button className="routine-cancel" type="button" onClick={resetForm} disabled={saving}>キャンセル</button>
                        )}
                        <button className="routine-submit" type="submit" disabled={saving}>
                            {saving ? "保存中…" : editingId ? "更新する" : "追加する"}
                        </button>
                    </div>
                    <p className="routine-hint">曜日を選ぶと、その曜日だけになります。間隔と組み合わせることもできます。</p>
                    <p className="routine-message" aria-live="polite">{message}</p>
                </form>

                {loading ? (
                    <p className="trash-state">読み込み中...</p>
                ) : routines.length === 0 ? (
                    <p className="trash-state">ルーティンはまだありません。</p>
                ) : (
                    <ul className="routine-list">
                        {routines.map((routine) => (
                            <li className={`routine-item${routine.enabled ? "" : " is-paused"}`} key={routine.id}>
                                <div className="routine-item-copy">
                                    <p className="routine-item-title">{routine.title}</p>
                                    <p className="routine-item-meta">{describeRoutine(routine)}</p>
                                </div>
                                <div className="routine-item-actions">
                                    <button type="button" onClick={() => beginEdit(routine)}>編集</button>
                                    <button type="button" onClick={() => void toggleRoutine(routine)}>
                                        {routine.enabled ? "停止" : "再開"}
                                    </button>
                                    <button type="button" className="is-danger" onClick={() => void deleteRoutine(routine)}>削除</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
