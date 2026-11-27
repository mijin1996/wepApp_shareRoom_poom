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

    it('로그인 없이 문의하면 AUTH_401', async () =>
    {
        const api = makeApi();

        const res = await api('POST', '/api/inquiries', { roomId: 'r-mw-1' });

        expect(res.status).toBe(401);
        expect(res.json.error?.code).toBe('AUTH_401');
    });

    it('운영 콘솔은 키가 없으면 AUTH_403', async () =>
    {
        const api = makeApi();

        const res = await api('GET', '/api/admin/reports');

        expect(res.status).toBe(403);
    });

    it('본인인증 → 문의 → 서류 없이 보내기 → DOC_428, 서류함에 올린 뒤 보내기 성공', async () =>
    {
        // Given
        const api = makeApi();
        const auth = await api('POST', '/api/auth/verify', { name: '김한별', phone: '010-1234-5678', gender: 'f', lang: 'ko' });
        const bearer = { authorization: 'Bearer ' + (auth.json.data.token as string) };

        // When
        const inquiry = await api('POST', '/api/inquiries', { roomId: 'r-mw-1', moveInDate: '2026-11-27', months: 1, children: '0-5m', contactTime: '오후', consultLang: 'ko', agree: true }, bearer);
        const noDoc = await api('POST', '/api/inquiries/' + inquiry.json.data.id + '/share-document', {}, bearer);
        await api('POST', '/api/me/document', { docType: 'single_parent' }, bearer);
        const shared = await api('POST', '/api/inquiries/' + inquiry.json.data.id + '/share-document', {}, bearer);

        // Then
        expect(inquiry.status).toBe(201);
        expect(noDoc.status).toBe(428);
        expect(noDoc.json.error?.code).toBe('DOC_428');
        expect(shared.json.data.docShared).toBe(true);
    });

    it('광고주 등록 전에는 광고 화면 API 가 AD_403, 광고 상품 · 혜택은 누구나 본다', async () =>
    {
        const api = makeApi();
        const auth = await api('POST', '/api/auth/verify', { name: '박집주인', phone: '010-7777-8888', gender: 'm', lang: 'ko' });
        const bearer = { authorization: 'Bearer ' + (auth.json.data.token as string) };

        const me = await api('GET', '/api/advertiser/me', undefined, bearer);
        const listings = await api('GET', '/api/advertiser/listings', undefined, bearer);
        const products = await api('GET', '/api/ad-products');
        const perks = await api('GET', '/api/perks');

        expect(me.json.data.advertiser).toBeNull();
        expect(listings.status).toBe(403);
        expect(listings.json.error?.code).toBe('AD_403');
        expect(products.json.data).toHaveLength(4);
        expect(perks.json.data.length).toBeGreaterThan(0);
    });

    it('문의 메뉴 제안은 로그인 없이 201', async () =>
    {
        const api = makeApi();

        const res = await api('POST', '/api/proposals', { kind: 'partner', org: '예시 이사', contact: 'hello@example.com', message: '제휴 할인 제안드려요' });

        expect(res.status).toBe(201);
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
