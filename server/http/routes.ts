// API 경로 → Service 호출. 화면 규칙은 여기 두지 않고 Service 에 맡긴다
import { AppError } from '../core/appError';
import type { Container } from '../container';
import type { Lang } from '../models/housing';
import type { ReportKind, ReportStatus, TrailEntry } from '../models/feedback';
import type { DocType, Gender, IdType, PayMethod, User } from '../models/people';
import faqJson from '../../data/faq.json';
import helpJson from '../../data/help_contacts.json';
import kindsJson from '../../data/report_kinds.json';
import { errorResponse, fromResult, okResponse } from './response';
import { int, parseChildren, parseRoomQuery, str } from './parse';
import { Router, type RouteContext } from './router';

const DEV_ADMIN_KEY = 'poom-admin-dev';

class BadRequestError extends Error
{
}

async function bodyOf(ctx: RouteContext): Promise<Record<string, unknown>>
{
    try
    {
        const data: unknown = await ctx.request.json();
        if (typeof data !== 'object' || data === null)
        {
            throw new BadRequestError('본문이 객체가 아님');
        }
        return data as Record<string, unknown>;
    }
    catch (error)
    {
        if (error instanceof SyntaxError || error instanceof BadRequestError)
        {
            throw new BadRequestError('잘못된 JSON');
        }
        throw error;
    }
}

function lang(value: unknown): Lang
{
    return value === 'en' ? 'en' : 'ko';
}

function bearer(ctx: RouteContext): string | undefined
{
    const header = ctx.request.headers.get('authorization') ?? '';
    return header.startsWith('Bearer ') ? header.slice(7) : undefined;
}

// 사용자 일이 필요한 경로 감싸기
function withUser(c: Container, handler: (ctx: RouteContext, user: User) => Promise<Response>)
{
    return async (ctx: RouteContext): Promise<Response> =>
    {
        const user = await c.auth.userByTokenAsync(bearer(ctx));
        return user.ok ? handler(ctx, user.data) : errorResponse(AppError.Unauthorized);
    };
}

// 운영 콘솔 경로 감싸기 (Mock: 개발용 키, Real: Cloudflare Access + Secret)
function withAdmin(adminKey: string, handler: (ctx: RouteContext) => Promise<Response>)
{
    return async (ctx: RouteContext): Promise<Response> =>
    {
        return ctx.request.headers.get('x-admin-key') === adminKey ? handler(ctx) : errorResponse(AppError.Forbidden);
    };
}

export function buildRouter(c: Container, adminKey: string | undefined): Router
{
    const key = adminKey ?? DEV_ADMIN_KEY;
    const r = new Router();

    // ---------- 공개 ----------
    r.add('GET', '/api/meta', async () => okResponse({ faq: faqJson.items, help: helpJson.contacts, reportKinds: kindsJson.kinds }));
    r.add('GET', '/api/search/suggest', async (ctx) => fromResult(await c.search.suggestAsync(ctx.query.get('q') ?? '')));
    r.add('POST', '/api/demand', async (ctx) =>
    {
        const b = await bodyOf(ctx);
        const monthly = typeof b.monthly === 'number' ? b.monthly : undefined;
        return fromResult(await c.search.recordDemandAsync({ gu: str(b.gu), householdSize: int(b.householdSize), monthly }), () => ({ ok: true }));
    });
    r.add('GET', '/api/rooms', async (ctx) => fromResult(await c.rooms.searchAsync(parseRoomQuery(ctx.query))));
    r.add('GET', '/api/rooms/map', async (ctx) => fromResult(await c.rooms.clustersAsync(parseRoomQuery(ctx.query))));
    r.add('GET', '/api/rooms/:id', async (ctx) => fromResult(await c.rooms.getRoomAsync(ctx.params.id, parseChildren(ctx.query.get('children')))));
    r.add('POST', '/api/partner', async (ctx) =>
    {
        const b = await bodyOf(ctx);
        const kind = b.kind === 'building' || b.kind === 'org' ? b.kind : 'owner';
        return fromResult(await c.saved.partnerInquiryAsync({ kind, gu: str(b.gu), rooms: int(b.rooms), contact: str(b.contact), message: str(b.message).slice(0, 500) }), (p) => ({ id: p.id }), 201);
    });

    // ---------- 본인인증 ----------
    r.add('POST', '/api/auth/verify', async (ctx) =>
    {
        const b = await bodyOf(ctx);
        const gender: Gender = b.gender === 'm' ? 'm' : 'f';
        const idType: IdType = b.idType === 'alien' ? 'alien' : 'kr';
        return fromResult(await c.auth.verifyAsync({ name: str(b.name), phone: str(b.phone), birthYear: int(b.birthYear), gender, idType, lang: lang(b.lang) }));
    });
    r.add('GET', '/api/me', withUser(c, async (_ctx, user) => okResponse(user)));

    // ---------- 신청 · 계약 · 결제 ----------
    r.add('GET', '/api/me/applications', withUser(c, async (_ctx, user) => fromResult(await c.applications.listMineAsync(user))));
    r.add('POST', '/api/applications', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        const docType = typeof b.docType === 'string' ? (b.docType as DocType) : undefined;
        return fromResult(await c.applications.applyAsync(user, {
            roomId: str(b.roomId),
            moveInDate: str(b.moveInDate),
            months: int(b.months),
            children: parseChildren(str(b.children)),
            contactTime: str(b.contactTime),
            consultLang: lang(b.consultLang),
            memo: str(b.memo),
            docType,
        }), undefined, 201);
    }));
    r.add('POST', '/api/applications/:id/documents', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.applications.uploadDocumentAsync(user, ctx.params.id, str(b.docType) as DocType));
    }));
    r.add('POST', '/api/applications/:id/sign', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.contracts.signAsync(user, ctx.params.id, str(b.signature)));
    }));
    r.add('GET', '/api/me/contracts', withUser(c, async (_ctx, user) => fromResult(await c.contracts.listMineAsync(user))));
    r.add('POST', '/api/contracts/:id/pay', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.contracts.payAsync(user, ctx.params.id, str(b.method) as PayMethod));
    }));
    r.add('GET', '/api/me/movein', withUser(c, async (_ctx, user) => fromResult(await c.contracts.moveInAsync(user))));

    // ---------- 관심 방 · 빈방 알림 ----------
    r.add('GET', '/api/me/favorites', withUser(c, async (_ctx, user) => fromResult(await c.saved.favoritesAsync(user))));
    r.add('POST', '/api/me/favorites/:roomId', withUser(c, async (ctx, user) => fromResult(await c.saved.toggleFavoriteAsync(user, ctx.params.roomId), (on) => ({ on }))));
    r.add('GET', '/api/me/saved-searches', withUser(c, async (_ctx, user) => fromResult(await c.saved.searchesAsync(user))));
    r.add('POST', '/api/me/saved-searches', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.saved.saveSearchAsync(user, str(b.query)), undefined, 201);
    }));
    r.add('DELETE', '/api/me/saved-searches/:id', withUser(c, async (ctx, user) => fromResult(await c.saved.deleteSearchAsync(user, ctx.params.id), () => ({ ok: true }))));

    // ---------- 의견 · 신고 ----------
    r.add('POST', '/api/report', async (ctx) =>
    {
        const b = await bodyOf(ctx);
        const user = await c.auth.userByTokenAsync(bearer(ctx));
        const env = typeof b.env === 'object' && b.env !== null ? (b.env as Record<string, string>) : {};
        const trail = Array.isArray(b.trail) ? (b.trail as TrailEntry[]) : [];
        return fromResult(await c.reports.submitAsync({
            clientKey: str(b.clientKey, 'anonymous'),
            kind: str(b.kind) as ReportKind,
            message: str(b.message),
            screenId: str(b.screenId),
            shot: typeof b.shot === 'string' ? b.shot : undefined,
            trail,
            env,
            channel: str(b.channel, 'test'),
            version: str(b.version),
            lang: lang(b.lang),
        }, user.ok ? user.data : undefined), (rp) => ({ id: rp.id }), 201);
    });
    r.add('GET', '/api/me/reports', withUser(c, async (_ctx, user) => fromResult(await c.reports.listMineAsync(user), (list) => list.map((rp) => ({ ...rp, shot: undefined, trail: [] })))));
    r.add('POST', '/api/me/reports/:id/confirm', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.reports.confirmAsync(user, ctx.params.id, b.resolved === true), () => ({ ok: true }));
    }));

    // ---------- 운영 콘솔 ----------
    r.add('GET', '/api/admin/applications', withAdmin(key, async () => fromResult(await c.applications.listAllAsync())));
    r.add('POST', '/api/admin/applications/:id/decision', withAdmin(key, async (ctx) =>
    {
        const b = await bodyOf(ctx);
        const decision = b.decision === 'approve' || b.decision === 'reject' ? b.decision : 'hold';
        return fromResult(await c.applications.decideAsync(ctx.params.id, decision));
    }));
    r.add('POST', '/api/admin/applications/:id/document-check', withAdmin(key, async (ctx) => fromResult(await c.applications.confirmDocumentAsync(ctx.params.id))));
    r.add('GET', '/api/admin/reports', withAdmin(key, async (ctx) =>
    {
        const kind = (ctx.query.get('kind') ?? undefined) as ReportKind | undefined;
        const status = (ctx.query.get('status') ?? undefined) as ReportStatus | undefined;
        return fromResult(await c.reports.listAsync({ kind, status }));
    }));
    r.add('PATCH', '/api/admin/reports/:id', withAdmin(key, async (ctx) =>
    {
        const b = await bodyOf(ctx);
        const res = b.resolution as { cause?: unknown; fix?: unknown; verify?: unknown } | undefined;
        return fromResult(await c.reports.updateAsync(ctx.params.id, {
            status: (b.status as ReportStatus | undefined) ?? undefined,
            severity: b.severity as never,
            priority: b.priority as never,
            resolution: res ? { cause: str(res.cause), fix: str(res.fix), verify: str(res.verify) } : undefined,
        }, str(b.by, '운영 매니저')));
    }));
    r.add('POST', '/api/admin/reports/:id/reply', withAdmin(key, async (ctx) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.reports.replyAsync(ctx.params.id, str(b.message)));
    }));
    r.add('GET', '/api/admin/demand', withAdmin(key, async () => fromResult(await c.search.demandStatsAsync())));
    r.add('GET', '/api/admin/partners', withAdmin(key, async () => fromResult(await c.saved.partnersAsync())));

    return r;
}

export { BadRequestError };
