export async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json", ...options.headers },
        ...options
    });
    if (response.ok) return (response.status === 204 ? null : await response.json()) as T;
    const error: { errors?: string[] } = await response.json().catch(() => ({}));
    throw new Error(error.errors?.[0] || "処理に失敗しました。もう一度試してください。");
}
