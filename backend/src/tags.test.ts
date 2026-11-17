import { describe, expect, it } from "bun:test";
import { inferTags, resolveTags } from "../../shared/tags";
import { tagFields } from "./tags";
import { z } from "zod";

describe("自動タグ", () => {
    it("タイトルから複数のタグを判定し、重複させない", () => {
        expect(inferTags("会議の資料を作る")).toEqual(["仕事"]);
        expect(inferTags("牛乳を買う")).toEqual(["買い物"]);
        expect(inferTags("掃除して薬を買う")).toEqual(["生活", "買い物", "健康"]);
        expect(inferTags("ＴｙｐｅＳｃｒｉｐｔの勉強と復習")).toEqual(["学習"]);
        expect(inferTags("やること")).toEqual([]);
    });
    it("自動設定のタイトル変更は再判定し、既存データも分類する", () => {
        expect(resolveTags("病院を予約する", { tags: ["仕事"], tagMode: "auto" }).tags).toEqual(["健康"]);
        expect(resolveTags("掃除").tags).toEqual(["生活"]);
    });
    it("手動タグと明示的なタグなしはタイトル変更でも保持する", () => {
        expect(resolveTags("会議", { tags: ["学習"], tagMode: "manual" })).toEqual({ tags: ["学習"], tagMode: "manual" });
        expect(resolveTags("会議", { tags: [], tagMode: "manual" }).tags).toEqual([]);
        expect(resolveTags("会議", undefined, { tags: ["健康", "健康"] })).toEqual({ tags: ["健康"], tagMode: "manual" });
    });
    it("自動へ戻す操作は過去の手動タグより優先する", () => {
        expect(resolveTags("会議", { tags: ["学習"], tagMode: "manual" }, { tagMode: "auto" })).toEqual({ tags: ["仕事"], tagMode: "auto" });
    });
    it("不明なタグ・モードは入力エラーになる", () => {
        const schema = z.object(tagFields);
        expect(schema.safeParse({ tags: ["不明"] }).success).toBe(false);
        expect(schema.safeParse({ tagMode: "unknown" }).success).toBe(false);
    });
});
