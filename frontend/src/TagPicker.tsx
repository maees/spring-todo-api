import { TAGS, inferTags, type Tag, type TagMode } from "../../shared/tags";

export function TagPicker({ title, tags, mode, onChange, disabled = false }: {
    title: string;
    tags: Tag[];
    mode: TagMode;
    onChange: (tags: Tag[], mode: TagMode) => void;
    disabled?: boolean;
}) {
    const selected = mode === "auto" ? inferTags(title) : tags;
    return <fieldset className="tag-picker" disabled={disabled}>
        <legend>タグ</legend>
        <label className="tag-auto"><input type="checkbox" checked={mode === "auto"}
            onChange={(event) => onChange(selected, event.target.checked ? "auto" : "manual")} />自動で付ける</label>
        <div className="tag-options">
            {TAGS.map((tag) => <label key={tag} className={`tag-chip${selected.includes(tag) ? " is-selected" : ""}`}>
                <input type="checkbox" checked={selected.includes(tag)} onChange={(event) => {
                    onChange(event.target.checked ? [...selected, tag] : selected.filter((item) => item !== tag), "manual");
                }} />{tag}
            </label>)}
        </div>
        <small>{mode === "auto" ? "タイトルから判定します。タグを選び直すと手動になります。" : "手動設定はタイトルを変更しても保持されます。すべて外すこともできます。"}</small>
    </fieldset>;
}
