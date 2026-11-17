import { useState, type FormEvent } from "react";
import type { Todo } from "./types";

type Draft = { title: string; date: string };
export function TodoEditor({ todo, date, today, onSave, onCancel }: {
    todo: Todo; date: string; today: string;
    onSave: (title: string, date: string) => Promise<void>; onCancel: () => void;
}) {
    const key = `todo-edit:${todo.id}`;
    const [draft, setDraft] = useState<Draft>(() => {
        try {
            const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
            if (saved && typeof saved.title === "string" && typeof saved.date === "string") return saved;
        } catch { /* Editing works without session storage. */ }
        return { title: todo.title, date };
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    function change(next: Draft) {
        setDraft(next);
        try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep the current draft in memory. */ }
    }
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy || !draft.title.trim()) return;
        setBusy(true);
        setError("");
        try {
            await onSave(draft.title.trim(), draft.date);
            try { sessionStorage.removeItem(key); } catch { /* Optional storage. */ }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "保存できませんでした。");
        } finally { setBusy(false); }
    }
    return <form className="task-editor" onSubmit={submit}>
        <label>やること<input autoFocus required maxLength={255} value={draft.title} disabled={busy}
            onChange={(event) => change({ ...draft, title: event.target.value })} /></label>
        <label>予定日<input type="date" required min={today} value={draft.date} disabled={busy}
            onChange={(event) => change({ ...draft, date: event.target.value })} /></label>
        <p className="draft-help">編集中の内容は、このタブに下書きとして残ります。</p>
        {error && <p role="alert">{error}</p>}
        <div className="editor-actions">
            <button type="submit" disabled={busy}>{busy ? "保存中…" : "保存"}</button>
            <button type="button" disabled={busy} onClick={() => {
                try { sessionStorage.removeItem(key); } catch { /* Optional storage. */ }
                onCancel();
            }}>変更を破棄</button>
        </div>
    </form>;
}
