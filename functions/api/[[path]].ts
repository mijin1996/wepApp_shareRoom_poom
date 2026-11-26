// Cloudflare Pages Functions 입구: /api/* 요청을 server/app.ts 로 넘긴다.
import { handleAsync, type IAppEnv } from '../../server/app';

interface IPagesContext
{
    request: Request;
    env: IAppEnv;
}

export async function onRequest(context: IPagesContext): Promise<Response>
{
    return handleAsync(context.request, context.env);
}
