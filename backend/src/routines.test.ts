import { describe, expect, it } from "bun:test";
import { applyRoutines, isRoutineDue } from "./routines";
import type { prisma } from "./prisma";

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

    it("同じタイトルの引き継ぎTodoがある日はルーティンを重ねて作らない", async () => {
        const routine = { id: "routine-1", title: "薬を飲む", ...baseRoutine };
        const carriedTodo = { id: 42n };
        const history: { routineId: string; dateKey: string; todoId: bigint }[] = [];
        let createdTodos = 0;
        const database = {
            todoDay: { upsert: async () => ({}) },
            routine: { findMany: async () => [routine] },
            routineHistory: {
                findUnique: async () => null,
                create: async ({ data }: { data: typeof history[number] }) => {
                    history.push(data);
                    return data;
                }
            },
            todo: {
                findFirst: async ({ where }: { where: { day: Date; title: string; carriedOver: true; deletedAt: null } }) => {
                    expect(where.title).toBe("薬を飲む");
                    expect(where.carriedOver).toBe(true);
                    return carriedTodo;
                },
                create: async () => {
                    createdTodos += 1;
                    return { id: 99n };
                }
            }
        };

        const created = await applyRoutines("2026-11-04", database as unknown as typeof prisma);

        expect(createdTodos).toBe(0);
        expect(created).toEqual([]);
        expect(history).toEqual([{ routineId: "routine-1", dateKey: "2026-11-04", todoId: carriedTodo.id }]);
    });
});
