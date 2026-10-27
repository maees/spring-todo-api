export type Todo = {
    id: string;
    title: string;
    done: boolean;
};

export type TodoFilter = "all" | "open" | "done";

export type TodoDaySummary = {
    date: string;
    todoCount: number;
};

export type BackupResult = {
    mode: "merge" | "replace";
    daysRestored: number;
    daysCreated: number;
    todosCreated: number;
    todosSkipped: number;
};