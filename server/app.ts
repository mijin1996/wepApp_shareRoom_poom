// 서버 입구: 개발(Vite)과 운영(Cloudflare Pages Functions)이 같은 함수를 부른다
import { AppError } from './core/appError';
import { createContainer, type Container } from './container';
import { errorResponse } from './http/response';
import { BadRequestError, buildRouter } from './http/routes';
import type { Router } from './http/router';

export interface IAppEnv
{
    USE_MOCK?: string;
    ADMIN_KEY?: string;
}

let _container: Container | undefined;
let _router: Router | undefined;

function routerFor(env: IAppEnv): Router
{
    if (!_router)
    {
        _container = createContainer();
        _router = buildRouter(_container, env.ADMIN_KEY);
    }
    return _router;
}

// 다른 사이트에서 보낸 쓰기 요청은 막는다 (POL_REPORT_10 CORS)
function isCrossSite(request: Request): boolean
{
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (!origin || !host || request.method === 'GET')
    {
        return false;
    }
    try
    {
        return new URL(origin).host !== host;
    }
    catch (error)
    {
        if (error instanceof TypeError)
        {
            return true;
        }
        throw error;
    }
}

export async function handleAsync(request: Request, env: IAppEnv): Promise<Response>
{
    if (env.USE_MOCK === 'false')
    {
        // Real 모드(D1 · R2 · 실제 업체)는 업체가 정해진 뒤 연결 (F-09)
        return new Response(JSON.stringify({ success: false, error: { code: 'COMMON_503', message: 'Real 모드 준비 중' } }), { status: 503 });
    }
    if (isCrossSite(request))
    {
        return errorResponse(AppError.Forbidden);
    }
    const url = new URL(request.url);
    const matched = routerFor(env).match(request.method, url.pathname);
    if (!matched)
    {
        return errorResponse(AppError.NotFound);
    }
    try
    {
        return await matched.handler({ request, params: matched.params, query: url.searchParams });
    }
    catch (error)
    {
        if (error instanceof BadRequestError)
        {
            return errorResponse(AppError.InvalidInput);
        }
        console.error('처리 중 오류', error);
        return errorResponse(AppError.Storage);
    }
}
