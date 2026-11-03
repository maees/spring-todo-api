import { useEffect, useRef, useState, type CSSProperties } from "react";
import { request } from "./api";
import type { Todo } from "./types";

type DayNote = { date: string; note: string };

function playReviewChime() {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const context: AudioContext = new AudioContextClass();
        void context.resume();
        const now = context.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5];

        notes.forEach((frequency, index) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(frequency, now + index * 0.11);
            gain.gain.setValueAtTime(0.0001, now + index * 0.11);
            gain.gain.exponentialRampToValueAtTime(0.055, now + index * 0.11 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.11 + 0.62);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(now + index * 0.11);
            oscillator.stop(now + index * 0.11 + 0.65);
        });

        window.setTimeout(() => void context.close().catch(() => undefined), 1400);
    } catch {
        // 音が鳴らなくても振り返りは続ける
    }
}

type ReviewModalProps = {
    open: boolean;
    closing: boolean;
    dateKey: string;
    dateLabel: string;
    isToday: boolean;
    soundEnabled: boolean;
    onClose: () => void;
};

export function ReviewModal({
    open,
    closing,
    dateKey,
    dateLabel,
    isToday,
    soundEnabled,
    onClose
}: ReviewModalProps) {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [memo, setMemo] = useState("");
    const [savedMemo, setSavedMemo] = useState("");
    const [memoMessage, setMemoMessage] = useState("");
    const [savingMemo, setSavingMemo] = useState(false);
    const closeButton = useRef<HTMLButtonElement>(null);
    const sparks = useRef(
        Array.from({ length: 11 }, (_, index) => ({
            left: 8 + ((index * 37) % 84),
            top: 7 + ((index * 53) % 82),
            delay: (index % 5) * 0.28,
            size: 3 + (index % 3) * 2
        }))
    );

    useEffect(() => {
        if (!open) return;
        let active = true;
        setLoading(true);
        setLoadError("");
        setMemo("");
        setSavedMemo("");
        setMemoMessage("");
        setTodos([]);

        Promise.allSettled([
            request<Todo[]>(`/api/todos?date=${dateKey}`),
            request<DayNote>(`/api/days/${dateKey}`)
        ]).then(([todosResult, noteResult]) => {
            if (!active) return;
            if (todosResult.status === "fulfilled") {
                setTodos(todosResult.value);
            } else {
                setLoadError("振り返りを読み込めませんでした。");
            }
            if (noteResult.status === "fulfilled") {
                setMemo(noteResult.value.note);
                setSavedMemo(noteResult.value.note);
            }
            setLoading(false);
        });

        return () => {
            active = false;
        };
    }, [open, dateKey]);

    useEffect(() => {
        if (!open) return;
        window.setTimeout(() => closeButton.current?.focus(), 80);
    }, [open]);

    useEffect(() => {
        if (!open || closing || !soundEnabled) return;
        playReviewChime();
    }, [open, closing, soundEnabled]);

    useEffect(() => {
        if (!open) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!memoMessage) return;
        const timer = window.setTimeout(() => setMemoMessage(""), 2200);
        return () => window.clearTimeout(timer);
    }, [memoMessage]);

    async function saveMemo() {
        if (savingMemo || memo === savedMemo) return;
        setSavingMemo(true);
        setMemoMessage("");
        try {
            const result = await request<DayNote>(`/api/days/${dateKey}/note`, {
                method: "PUT",
                body: JSON.stringify({ note: memo })
            });
            setMemo(result.note);
            setSavedMemo(result.note);
            setMemoMessage("メモを保存しました");
        } catch (error) {
            setMemoMessage(error instanceof Error ? error.message : "メモを保存できませんでした。");
        } finally {
            setSavingMemo(false);
        }
    }

    if (!open) return null;

    const total = todos.length;
    const done = todos.filter((todo) => todo.done);
    const doneCount = done.length;
    const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);
    const remaining = total - doneCount;
    const message = total === 0
        ? "今日はまだ静かな一日。"
        : doneCount === 0
            ? "今日はまだ。明日の自分にバトンを渡そう。"
            : percent === 100
                ? "全部できた。今日のあなた、最高。"
                : percent >= 70
                    ? "いいペース。ちゃんと前に進んでる。"
                    : percent >= 40
                        ? "半分以上。えらい。"
                        : "ひとつでも進めたら、それは前進。";

    return (
        <div
            className={`review-overlay${closing ? " is-closing" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
        >
            <button className="review-backdrop" type="button" aria-label="振り返りを閉じる" onClick={onClose} />
            <section className="review-card">
                {sparks.current.map((spark, index) => (
                    <span
                        aria-hidden="true"
                        className="review-spark"
                        key={index}
                        style={{
                            left: `${spark.left}%`,
                            top: `${spark.top}%`,
                            width: `${spark.size}px`,
                            height: `${spark.size}px`,
                            animationDelay: `${spark.delay}s`
                        }}
                    />
                ))}
                <p className="review-kicker">{isToday ? "DAY REVIEW" : "DAY LOG"}</p>
                <h2 className="review-title" id="review-title">
                    <span>{isToday ? "今日の" : "あの日の"}</span>
                    <em>振り返り</em>
                </h2>
                <p className="review-date">{dateLabel}</p>

                <div className="review-score" aria-label={`${total}件中${doneCount}件完了、達成率${percent}パーセント`}>
                    <strong>{doneCount}</strong>
                    <span>/ {total} 完了</span>
                    <small>{percent}%</small>
                </div>

                <p className="review-message">{message}</p>

                {loading ? (
                    <p className="review-loading">読み込み中…</p>
                ) : loadError ? (
                    <p className="review-empty">{loadError}</p>
                ) : doneCount > 0 ? (
                    <ul className="review-list">
                        {done.map((todo, index) => (
                            <li key={todo.id} style={{ "--i": index } as CSSProperties}>
                                <span aria-hidden="true">✓</span>
                                <span>{todo.title}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="review-empty">完了したタスクはまだありません。</p>
                )}

                {!loading && remaining > 0 && (
                    <p className="review-next">あと {remaining} 件は、明日の自分へ。</p>
                )}

                <label className="review-memo">
                    <span>ひとことメモ</span>
                    <input
                        type="text"
                        maxLength={500}
                        placeholder="今日のひとことを残す"
                        value={memo}
                        disabled={loading}
                        onChange={(event) => setMemo(event.target.value)}
                        onBlur={() => void saveMemo()}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                void saveMemo();
                            }
                        }}
                    />
                </label>
                <p className="review-memo-status" aria-live="polite">{savingMemo ? "保存中…" : memoMessage}</p>

                <div className="review-actions">
                    <button
                        className="review-sound"
                        type="button"
                        onClick={() => {
                            if (soundEnabled) playReviewChime();
                        }}
                        disabled={!soundEnabled}
                    >
                        <span aria-hidden="true">♪</span> もう一度
                    </button>
                    <button ref={closeButton} className="review-close" type="button" onClick={onClose}>
                        閉じる
                    </button>
                </div>
            </section>
        </div>
    );
}
