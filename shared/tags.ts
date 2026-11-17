export const TAGS = ["仕事", "生活", "買い物", "学習", "健康"] as const;
export type Tag = typeof TAGS[number];
export type TagMode = "auto" | "manual";

const rules: Record<Tag, readonly string[]> = {
    仕事: ["会議", "資料", "仕事", "出勤", "打ち合わせ", "打合せ", "議事録", "報告", "見積", "請求", "メール", "納品"],
    生活: ["掃除", "洗濯", "料理", "片付け", "片づけ", "ゴミ", "ごみ", "家賃", "役所", "郵便", "食器"],
    買い物: ["買い物", "買う", "購入", "注文", "スーパー", "牛乳", "日用品"],
    学習: ["勉強", "学習", "読書", "読む", "講座", "宿題", "復習", "予習", "typescript", "javascript", "プログラミング", "英語"],
    健康: ["病院", "通院", "歯医者", "薬", "運動", "散歩", "筋トレ", "ストレッチ", "ジム", "健診", "検診", "ランニング"]
};

export function inferTags(title: string): Tag[] {
    const normalized = title.normalize("NFKC").toLowerCase();
    return TAGS.filter((tag) => rules[tag].some((word) => normalized.includes(word)));
}

export function resolveTags(
    title: string,
    current?: { tags?: readonly string[]; tagMode?: string },
    input: { tags?: readonly Tag[]; tagMode?: TagMode } = {}
): { tags: Tag[]; tagMode: TagMode } {
    const tagMode = input.tagMode ?? (input.tags !== undefined ? "manual" : current?.tagMode === "manual" ? "manual" : "auto");
    const selected = input.tags ?? current?.tags ?? [];
    return {
        tags: tagMode === "auto" ? inferTags(title) : TAGS.filter((tag) => selected.includes(tag)),
        tagMode
    };
}
