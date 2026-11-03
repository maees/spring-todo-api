import { describe, expect, it } from "bun:test";
import { isRoutineDue } from "./routines";

const baseRoutine = {
    enabled: true,
    daysOfWeek: [] as string[],
    intervalDays: 1,
    startDate: "2026-11-03",
    createdAt: new Date("2026-11-03T00:00:00.000Z")
};

describe("ルーティンの繰り返し", () => {
    it("毎日はどの日も対象になる", () => {
        expect(isRoutineDue(baseRoutine, "2026-11-03")).toBe(true);
        expect(isRoutineDue(baseRoutine, "2026-11-04")).toBe(true);
    });

    it("3日ごとは開始日から数えて3日周期になる", () => {
        const routine = { ...baseRoutine, intervalDays: 3 };
        expect(isRoutineDue(routine, "2026-11-03")).toBe(true);
        expect(isRoutineDue(routine, "2026-11-04")).toBe(false);
        expect(isRoutineDue(routine, "2026-11-06")).toBe(true);
        expect(isRoutineDue(routine, "2026-11-09")).toBe(true);
    });

    it("隔週は14日周期になる", () => {
        const routine = { ...baseRoutine, intervalDays: 14 };
        expect(isRoutineDue(routine, "2026-11-03")).toBe(true);
        expect(isRoutineDue(routine, "2026-11-10")).toBe(false);
        expect(isRoutineDue(routine, "2026-11-17")).toBe(true);
    });

    it("曜日指定は間隔と組み合わせて判定する", () => {
        const routine = { ...baseRoutine, intervalDays: 7, daysOfWeek: ["2"] };
        expect(isRoutineDue(routine, "2026-11-03")).toBe(true);
        expect(isRoutineDue(routine, "2026-11-10")).toBe(true);
        expect(isRoutineDue(routine, "2026-11-04")).toBe(false);
        expect(isRoutineDue(routine, "2026-11-17")).toBe(true);
    });

    it("開始日より前や停止中は対象外", () => {
        expect(isRoutineDue(baseRoutine, "2026-11-02")).toBe(false);
        expect(isRoutineDue({ ...baseRoutine, enabled: false }, "2026-11-03")).toBe(false);
    });
});
