// API 끝에서 끝까지: 응답 모양 · 에러 코드 · 권한
import { describe, expect, it } from 'vitest';
import { handleAsync } from '../server/app';
import { buildRouter } from '../server/http/routes';
import { makeContainer } from './helpers';

const ADMIN = 'test-admin';

function makeApi()
{
    const { c } = makeContainer();
    const router = buildRouter(c, ADMIN);
    return async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    {
        const url = new URL('http://localhost' + path);
        const matched = router.match(method, url.pathname);
        if (!matched)
        {
            throw new Error('경로 없음 ' + path);
        }
        const request = new Request(url, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
        const response = await matched.handler({ request, params: matched.params, query: url.searchParams });
        return { status: response.status, json: (await response.json()) as { success: boolean; data?: any; error?: { code: string } } };
    };
}

describe('API', () =>
{
    it('GET /api/rooms 는 { success, data } 모양', async () =>
    {
        const api = makeApi();

        const res = await api('GET', '/api/rooms?soon=1');

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(Array.isArray(res.json.data)).toBe(true);
    });

    it('로그인 없이 신청하면 AUTH_401', async () =>
    {
        const api = makeApi();

        const res = await api('POST', '/api/applications', { roomId: 'r-mw-1' });

        expect(res.status).toBe(401);
        expect(res.json.error?.code).toBe('AUTH_401');
    });

    it('운영 콘솔은 키가 없으면 AUTH_403', async () =>
    {
        const api = makeApi();

        const res = await api('GET', '/api/admin/reports');

        expect(res.status).toBe(403);
    });

    it('본인인증 → 신청 → 서류 없이 계약 시도 → DOC_428', async () =>
    {
        // Given
        const api = makeApi();
        const auth = await api('POST', '/api/auth/verify', { name: '김한별', phone: '010-1234-5678', birthYear: 1990, gender: 'f', lang: 'ko' });
        const token = auth.json.data.token as string;
        const bearer = { authorization: 'Bearer ' + token };

        // When
        const app = await api('POST', '/api/applications', { roomId: 'r-mw-1', moveInDate: '2026-11-27', months: 1, children: '0-5m', contactTime: '오후', consultLang: 'ko' }, bearer);
        await api('POST', `/api/admin/applications/${app.json.data.id}/decision`, { decision: 'approve' }, { 'x-admin-key': ADMIN });
        const sign = await api('POST', `/api/applications/${app.json.data.id}/sign`, { signature: '김한별' }, bearer);

        // Then
        expect(app.status).toBe(201);
        expect(sign.status).toBe(428);
        expect(sign.json.error?.code).toBe('DOC_428');
    });

    it('잘못된 JSON 본문은 COMMON_400', async () =>
    {
        // When
        const response = await handleAsync(new Request('http://localhost/api/demand', { method: 'POST', body: '{깨짐' }), {});

        // Then
        expect(response.status).toBe(400);
        expect(((await response.json()) as { error: { code: string } }).error.code).toBe('COMMON_400');
    });

    it('다른 사이트에서 보낸 쓰기 요청은 막는다', async () =>
    {
        const response = await handleAsync(new Request('http://localhost/api/demand', {
            method: 'POST',
            headers: { origin: 'https://evil.example', host: 'localhost' },
            body: '{}',
        }), {});

        expect(response.status).toBe(403);
    });
});
