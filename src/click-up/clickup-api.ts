/**
 * ClickUp API client for content sync.
 * Uses native fetch (Node 18+). No external HTTP dependencies.
 */

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClickUpAttachment {
    id: string;
    date: string;
    title: string;
    url: string;
    mimetype?: string;
    filesize?: number;
}

export interface ClickUpComment {
    id: string;
    comment_text: string;
    comment?: unknown[];
    user?: unknown;
    date: string;
}

export interface ClickUpTask {
    id: string;
    custom_id?: string | null;
    name: string;
    description?: string;
    markdown_description?: string;
    status?: unknown;
    assignees?: unknown[];
    tags?: unknown[];
    priority?: unknown;
    due_date?: string | null;
    start_date?: string | null;
    creator?: unknown;
    date_created?: string;
    date_updated?: string;
    custom_fields?: unknown[];
    attachments?: ClickUpAttachment[];
    list?: unknown;
    folder?: unknown;
    space?: unknown;
    url?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
    return { Authorization: token, 'Content-Type': 'application/json' };
}

async function apiGet(endpoint: string, token: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`${CLICKUP_API_BASE}${endpoint}`);
    if (params) {
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const response = await fetch(url.toString(), { headers: authHeaders(token) });
    if (!response.ok) {
        throw new Error(`ClickUp API ${response.status} for ${endpoint}: ${await response.text()}`);
    }
    return response.json();
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getTasksInList(listId: string, token: string, since?: string): Promise<ClickUpTask[]> {
    const allTasks: ClickUpTask[] = [];
    let page = 0;
    const dateUpdatedGt = since ? String(new Date(since).getTime()) : undefined;

    while (true) {
        const params: Record<string, string> = {
            page: String(page),
            include_closed: 'true',
            subtasks: 'true',
            include_markdown_description: 'true',
        };
        if (dateUpdatedGt) params.date_updated_gt = dateUpdatedGt;

        const data = await apiGet(`/list/${listId}/task`, token, params) as { tasks?: ClickUpTask[]; last_page?: boolean };
        const tasks = data.tasks ?? [];
        allTasks.push(...tasks);
        if (data.last_page === true || tasks.length === 0) break;
        page++;
    }

    return allTasks;
}

export async function getTaskDetail(taskId: string, token: string): Promise<ClickUpTask> {
    return apiGet(`/task/${taskId}`, token, { include_markdown_description: 'true' }) as Promise<ClickUpTask>;
}

export async function getTaskActivity(taskId: string, token: string): Promise<ClickUpComment[]> {
    try {
        const data = await apiGet(`/task/${taskId}/comment`, token) as { comments?: ClickUpComment[] };
        return data.comments ?? [];
    } catch {
        return [];
    }
}

export async function downloadAttachment(url: string, token: string): Promise<Buffer> {
    const response = await fetch(url, { headers: { Authorization: token } });
    if (!response.ok) {
        throw new Error(`Failed to download attachment: HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
}

/**
 * Validate the token by calling the user endpoint.
 * Returns true if the token is valid.
 */
export async function validateToken(token: string): Promise<boolean> {
    try {
        await apiGet('/user', token);
        return true;
    } catch {
        return false;
    }
}
