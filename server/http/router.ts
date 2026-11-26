// 작은 라우터: "GET /api/rooms/:id" 모양의 경로를 처리 함수로 연결
export interface RouteContext
{
    readonly request: Request;
    readonly params: Readonly<Record<string, string>>;
    readonly query: URLSearchParams;
}

export type RouteHandler = (ctx: RouteContext) => Promise<Response>;

interface IRoute
{
    readonly method: string;
    readonly parts: readonly string[];
    readonly handler: RouteHandler;
}

export class Router
{
    private readonly _routes: IRoute[] = [];

    public add(method: string, path: string, handler: RouteHandler): this
    {
        this._routes.push({ method, parts: path.split('/').filter(Boolean), handler });
        return this;
    }

    public match(method: string, pathname: string): { handler: RouteHandler; params: Record<string, string> } | undefined
    {
        const parts = pathname.split('/').filter(Boolean);
        for (const route of this._routes)
        {
            if (route.method !== method || route.parts.length !== parts.length)
            {
                continue;
            }
            const params: Record<string, string> = {};
            const matched = route.parts.every((part, i) =>
            {
                if (part.startsWith(':'))
                {
                    params[part.slice(1)] = decodeURIComponent(parts[i]);
                    return true;
                }
                return part === parts[i];
            });
            if (matched)
            {
                return { handler: route.handler, params };
            }
        }
        return undefined;
    }
}
