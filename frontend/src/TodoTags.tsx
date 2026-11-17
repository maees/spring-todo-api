import { useEffect, useRef, useState } from "react";
import { TAGS, type Tag, type TagMode } from "../../shared/tags";
import type { Todo } from "./types";
import { request } from "./api";

export function TodoTags({ todo, onUpdated }: { todo: Todo; onUpdated: (todo: Todo) => void }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!open) return;
        const closeOutside = (event: PointerEvent) => {
            if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener("pointerdown", closeOutside);
        return () => document.removeEventListener("pointerdown", closeOutside);
    }, [open]);
    async function save(tags: Tag[], tagMode: TagMode) {
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            onUpdated(await request<Todo>(`/api/todos/${todo.id}/tags`, {
                method: "PATCH", body: JSON.stringify({ tags, tagMode })
            }));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "タグを変更できませんでした。");
        } finally { setBusy(false); }
    }
    return <div ref={container} className="record-tags" onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
        <button ref={trigger} className="record-tags-trigger" type="button" aria-expanded={open}
            aria-label={`「${todo.title}」のタグを変更`} onClick={() => setOpen(!open)}>
            {todo.tags.length ? todo.tags.join("・") : "タグなし"}<span aria-hidden="true"> ▾</span>
        </button>
        {open && <div className="record-tags-editor" role="group" aria-label={`「${todo.title}」のタグ`}>
            <div className="record-tag-choices">
                {TAGS.map((tag) => <button key={tag} type="button" aria-pressed={todo.tags.includes(tag)} disabled={busy}
                    onClick={() => void save(todo.tags.includes(tag) ? todo.tags.filter((item) => item !== tag) : [...todo.tags, tag], "manual")}>{tag}</button>)}
                <button type="button" disabled={busy} aria-pressed={todo.tags.length === 0 && todo.tagMode === "manual"} onClick={() => void save([], "manual")}>タグなし</button>
                <button type="button" disabled={busy} aria-pressed={todo.tagMode === "auto"} onClick={() => void save([], "auto")}>自動に戻す</button>
                <button type="button" onClick={() => setOpen(false)}>閉じる</button>
            </div>
            <small role="status">{busy ? "保存中…" : "選ぶと保存されます（複数選択可）"}</small>
            {error && <p role="alert">{error}</p>}
        </div>}
    </div>;
}
