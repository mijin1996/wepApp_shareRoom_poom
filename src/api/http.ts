// HTTP 클라이언트: 화면은 fetch 를 직접 쓰지 않고 이것만 쓴다. 결과는 Result 모양으로
const SESSION_KEY = 'poom.session';
const ADMIN_KEY_STORE = 'poom.adminKey';
const TIMEOUT_MS = 15000;

export type ApiResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly code: string };

export function getToken(): string | null
{
    return localStorage.getItem(SESSION_KEY);
}

export function setToken(token: string | null): void
{
    if (token)
    {
        localStorage.setItem(SESSION_KEY, token);
    }
    else
    {
        localStorage.removeItem(SESSION_KEY);
    }
}

export function getAdminKey(): string
{
    return sessionStorage.getItem(ADMIN_KEY_STORE) ?? '';
}

export function setAdminKey(key: string): void
{
    sessionStorage.setItem(ADMIN_KEY_STORE, key);
}

interface IRequestOptions
{
    readonly method?: string;
    readonly body?: unknown;
    readonly admin?: boolean;
}

export async function requestAsync<T>(path: string, options: IRequestOptions = {}): Promise<ApiResult<T>>
{
    const headers: Record<string, string> = { accept: 'application/json' };
    const token = getToken();
    if (token)
    {
        headers.authorization = 'Bearer ' + token;
    }
    if (options.admin)
    {
        headers['x-admin-key'] = getAdminKey();
    }
    if (options.body !== undefined)
    {
        headers['content-type'] = 'application/json';
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try
    {
        const response = await fetch(path, {
            method: options.method ?? 'GET',
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            signal: controller.signal,
        });
        const json = (await response.json()) as { success?: boolean; data?: T; error?: { code?: string } };
        if (response.ok && json.success)
        {
            return { ok: true, data: json.data as T };
        }
        if (response.status === 401)
        {
            setToken(null);
        }
        return { ok: false, code: json.error?.code ?? 'COMMON_500' };
    }
    catch (error)
    {
        if (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError'))
        {
            return { ok: false, code: 'NETWORK' };
        }
        if (error instanceof SyntaxError)
        {
            return { ok: false, code: 'COMMON_500' };
        }
        throw error;
    }
    finally
    {
        clearTimeout(timer);
    }
}
