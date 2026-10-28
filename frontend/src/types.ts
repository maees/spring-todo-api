export type Todo = {
    id: string;
    title: string;
    done: boolean;
    important?: boolean;
};

export type TodoFilter = "all" | "open" | "done";

export type TodoDaySummary = {
    date: string;
    todoCount: number;
};

export type TrashTodo = Todo & {
    date: string;
    deletedAt: string | null;
};

export type BackupResult = {
    mode: "merge" | "replace";
    daysRestored: number;
    daysCreated: number;
    todosCreated: number;
    todosSkipped: number;
};

export type Routine = {
    id: string;
    title: string;
    enabled: boolean;
    daysOfWeek: number[];
};