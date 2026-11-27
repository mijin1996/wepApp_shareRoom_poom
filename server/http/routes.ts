// API 경로 → Service 호출. 화면 규칙은 여기 두지 않고 Service 에 맡긴다
import { AppError } from '../core/appError';
import type { Container } from '../container';
import type { Lang } from '../models/housing';
import type { ReportKind, ReportStatus, TrailEntry } from '../models/feedback';
import { INQUIRY_STATUSES, type DocType, type Gender, type IdType, type InquiryStatus, type PayMethod, type Urgency, type User } from '../models/people';
import type { BuildingType, HouseType } from '../models/housing';
import type { ListingDraft, ProductId } from '../models/advertising';
import { PERK_KINDS, type PerkAction, type PerkKind, type ProposalKind, type ProposalStatus } from '../models/perk';
import type { PerkInput } from '../services/perkService';
import { TOPICS, type Topic } from '../models/community';
import type { NoticeCategory } from '../models/notice';
import type { NoticeInput } from '../services/noticeService';
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

// 확인된 광고주만 (공인중개사 · 집주인)
function withAdvertiser(c: Container, handler: (ctx: RouteContext, advertiser: import('../models/advertising').Advertiser) => Promise<Response>)
{
    return withUser(c, async (ctx, user) =>
    {
        const advertiser = await c.advertisers.verifiedOfAsync(user);
        return advertiser.ok ? handler(ctx, advertiser.data) : errorResponse(advertiser.error);
    });
}

function bool(value: unknown): boolean
{
    return value === true;
}

function num(value: unknown): number
{
    return typeof value === 'number' && Number.isFinite(value) ? value : -1;
}

function draftOf(b: Record<string, unknown>): ListingDraft
{
    return {
        houseType: (b.houseType === 'dad' ? 'dad' : b.houseType === 'mom' ? 'mom' : '') as HouseType,
        placeId: str(b.placeId),
        titleKo: str(b.titleKo),
        titleEn: str(b.titleEn),
        buildingType: (['house', 'apartment', 'villa', 'other'].includes(str(b.buildingType)) ? str(b.buildingType) : 'other') as BuildingType,
        bedrooms: num(b.bedrooms),
        privateM2: num(b.privateM2),
        sharedM2: num(b.sharedM2),
        households: num(b.households),
        privateBath: bool(b.privateBath),
        deposit: num(b.deposit),
        rent: num(b.rent),
        fee: num(b.fee),
        availableFrom: str(b.availableFrom),
        minMonths: num(b.minMonths),
        elevator: bool(b.elevator),
        noStairs: bool(b.noStairs),
        parking: bool(b.parking),
        foreignerOk: bool(b.foreignerOk),
        descriptionKo: str(b.descriptionKo),
        descriptionEn: str(b.descriptionEn),
    };
}

function statusOf(value: unknown): InquiryStatus
{
    return (INQUIRY_STATUSES.includes(value as InquiryStatus) ? value : '') as InquiryStatus;
}

export function buildRouter(c: Container, adminKey: string | undefined): Router
{
    const key = adminKey ?? DEV_ADMIN_KEY;
    const r = new Router();

    // ---------- 공개 ----------
    r.add('GET', '/api/meta', async () => okResponse({ faq: faqJson.items, help: helpJson.contacts, reportKinds: kindsJson.kinds }));
    r.add('GET', '/api/areas', async () => fromResult(await c.search.areasAsync()));
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
    r.add('GET', '/api/ad-products', async () => okResponse(c.billing.products()));
    r.add('POST', '/api/proposals', async (ctx) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.proposals.submitAsync({ kind: str(b.kind) as ProposalKind, org: str(b.org), name: str(b.name), contact: str(b.contact), message: str(b.message) }), (pr) => ({ id: pr.id }), 201);
    });
    const perkKindOf = (value: string | null): PerkKind | undefined => (PERK_KINDS.includes(value as PerkKind) ? (value as PerkKind) : undefined);
    r.add('GET', '/api/perks', async (ctx) => fromResult(await c.perks.listAsync(perkKindOf(ctx.query.get('kind')))));
    r.add('POST', '/api/perks/:id/open', async (ctx) => fromResult(await c.perks.openAsync(ctx.params.id), (url) => ({ url })));

    // ---------- 본인인증 ----------
    r.add('POST', '/api/auth/verify', async (ctx) =>
    {
        const b = await bodyOf(ctx);
        const gender: Gender = b.gender === 'm' ? 'm' : 'f';
        const idType: IdType = b.idType === 'alien' ? 'alien' : 'kr';
        return fromResult(await c.auth.verifyAsync({ name: str(b.name), phone: str(b.phone), gender, idType, lang: lang(b.lang) }));
    });
    r.add('GET', '/api/me', withUser(c, async (_ctx, user) => okResponse(user)));

    // ---------- 문의 · 서류함 (품은 전달 · 기록만) ----------
    r.add('GET', '/api/me/inquiries', withUser(c, async (_ctx, user) => fromResult(await c.inquiries.listMineAsync(user))));
    r.add('POST', '/api/inquiries', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.inquiries.sendAsync(user, {
            roomId: str(b.roomId),
            moveInDate: str(b.moveInDate),
            months: int(b.months),
            children: parseChildren(str(b.children)),
            contactTime: str(b.contactTime),
            consultLang: lang(b.consultLang),
            situation: str(b.situation),
            urgency: typeof b.urgency === 'string' ? (b.urgency as Urgency) : undefined,
            agree: b.agree === true,
        }), undefined, 201);
    }));
    r.add('POST', '/api/inquiries/:id/share-document', withUser(c, async (ctx, user) => fromResult(await c.inquiries.shareDocumentAsync(user, ctx.params.id))));
    r.add('POST', '/api/inquiries/:id/status', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.inquiries.tenantUpdateAsync(user, ctx.params.id, statusOf(b.status)));
    }));
    r.add('GET', '/api/me/document', withUser(c, async (_ctx, user) => fromResult(await c.inquiries.myDocumentAsync(user), (doc) => ({ document: doc ?? null }))));
    r.add('POST', '/api/me/document', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.inquiries.uploadDocumentAsync(user, str(b.docType) as DocType));
    }));
    r.add('GET', '/api/me/perk-requests', withUser(c, async (_ctx, user) => fromResult(await c.perks.myRequestsAsync(user))));
    r.add('POST', '/api/perks/:id/request', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.perks.requestAsync(user, ctx.params.id, str(b.note)), (pr) => ({ id: pr.id }), 201);
    }));

    // ---------- 광고주 (공인중개사 · 집주인) ----------
    r.add('GET', '/api/advertiser/me', withUser(c, async (_ctx, user) =>
    {
        const mine = await c.advertisers.mineAsync(user);
        if (mine.ok)
        {
            return okResponse({ advertiser: mine.data });
        }
        return mine.error === AppError.NotFound ? okResponse({ advertiser: null }) : errorResponse(mine.error);
    }));
    r.add('POST', '/api/advertiser', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.advertisers.registerAsync(user, {
            kind: b.kind === 'agent' ? 'agent' : 'owner',
            nameKo: str(b.nameKo),
            nameEn: str(b.nameEn),
            agentRegNo: str(b.agentRegNo),
            ownershipDoc: b.ownershipDoc === true,
        }), undefined, 201);
    }));
    r.add('GET', '/api/advertiser/listings', withAdvertiser(c, async (_ctx, a) => fromResult(await c.listings.mineAsync(a))));
    r.add('POST', '/api/advertiser/listings', withAdvertiser(c, async (ctx, a) => fromResult(await c.listings.submitAsync(a, draftOf(await bodyOf(ctx))), undefined, 201)));
    r.add('POST', '/api/advertiser/listings/:id/end', withAdvertiser(c, async (ctx, a) => fromResult(await c.listings.endMineAsync(a, ctx.params.id))));
    r.add('POST', '/api/advertiser/buy', withAdvertiser(c, async (ctx, a) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.billing.buyAsync(a, str(b.productId) as ProductId, str(b.listingId), str(b.method, 'card') as PayMethod), undefined, 201);
    }));
    r.add('GET', '/api/advertiser/statement', withAdvertiser(c, async (_ctx, a) => fromResult(await c.billing.statementAsync(a))));
    r.add('POST', '/api/advertiser/settle', withAdvertiser(c, async (ctx, a) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.billing.settleAsync(a, str(b.method, 'card') as PayMethod), (total) => ({ total }));
    }));
    r.add('GET', '/api/advertiser/inquiries', withAdvertiser(c, async (_ctx, a) => fromResult(await c.inquiries.receivedAsync(a))));
    r.add('POST', '/api/advertiser/inquiries/:id/status', withAdvertiser(c, async (ctx, a) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.inquiries.advertiserUpdateAsync(a, ctx.params.id, statusOf(b.status)));
    }));

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

    // ---------- 공지사항 ----------
    r.add('GET', '/api/notices', async () => fromResult(await c.notices.listAsync()));
    r.add('GET', '/api/notices/:id', async (ctx) => fromResult(await c.notices.getAsync(ctx.params.id)));

    // ---------- 커뮤니티 (묻고 답하기) ----------
    const topicOf = (value: unknown): Topic | undefined => (TOPICS.includes(value as Topic) ? (value as Topic) : undefined);
    const answerIdOf = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);
    r.add('GET', '/api/community', async (ctx) => fromResult(await c.community.listAsync({ topic: topicOf(ctx.query.get('topic')), q: ctx.query.get('q') ?? '' })));
    r.add('GET', '/api/community/:id', async (ctx) =>
    {
        const viewer = await c.auth.userByTokenAsync(bearer(ctx));
        return fromResult(await c.community.getAsync(ctx.params.id, viewer.ok ? viewer.data : undefined));
    });
    r.add('POST', '/api/community', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.community.askAsync(user, { topic: topicOf(b.topic) ?? ('' as Topic), title: str(b.title), body: str(b.body), lang: lang(b.lang) }), (q) => ({ id: q.id }), 201);
    }));
    r.add('POST', '/api/community/:id/answers', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.community.answerAsync(user, ctx.params.id, str(b.body)), (a) => ({ id: a.id }), 201);
    }));
    r.add('POST', '/api/community/:id/solve', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.community.solveAsync(user, ctx.params.id, str(b.answerId)), () => ({ ok: true }));
    }));
    r.add('POST', '/api/community/:id/flag', withUser(c, async (ctx, user) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.community.flagAsync(user, ctx.params.id, answerIdOf(b.answerId)));
    }));

    // ---------- 운영 콘솔 ----------
    const noticeInputOf = (b: Record<string, unknown>): NoticeInput => ({
        category: str(b.category) as NoticeCategory,
        titleKo: str(b.titleKo),
        bodyKo: str(b.bodyKo),
        titleEn: str(b.titleEn),
        bodyEn: str(b.bodyEn),
        pinned: b.pinned === true,
        published: b.published !== false,
    });
    r.add('GET', '/api/admin/notices', withAdmin(key, async () => fromResult(await c.notices.listAllAsync())));
    r.add('POST', '/api/admin/notices', withAdmin(key, async (ctx) => fromResult(await c.notices.createAsync(noticeInputOf(await bodyOf(ctx))), undefined, 201)));
    r.add('PUT', '/api/admin/notices/:id', withAdmin(key, async (ctx) => fromResult(await c.notices.updateAsync(ctx.params.id, noticeInputOf(await bodyOf(ctx))))));
    r.add('GET', '/api/admin/community', withAdmin(key, async () => fromResult(await c.community.listAllAsync())));
    r.add('POST', '/api/admin/community/:id/answers', withAdmin(key, async (ctx) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.community.officialAnswerAsync(ctx.params.id, str(b.body)), (a) => ({ id: a.id }), 201);
    }));
    r.add('POST', '/api/admin/community/:id/hidden', withAdmin(key, async (ctx) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.community.setHiddenAsync(ctx.params.id, answerIdOf(b.answerId), b.hidden === true), () => ({ ok: true }));
    }));
    r.add('GET', '/api/admin/inquiries', withAdmin(key, async () => fromResult(await c.inquiries.listAllAsync())));
    r.add('GET', '/api/admin/stats', withAdmin(key, async () => fromResult(await c.inquiries.statsAsync())));
    r.add('GET', '/api/admin/documents', withAdmin(key, async () => fromResult(await c.inquiries.listDocumentsAsync())));
    r.add('POST', '/api/admin/documents/:userId/check', withAdmin(key, async (ctx) => fromResult(await c.inquiries.confirmDocumentAsync(ctx.params.userId))));
    r.add('GET', '/api/admin/advertisers', withAdmin(key, async () => fromResult(await c.advertisers.listAllAsync())));
    r.add('POST', '/api/admin/advertisers/:id/verify', withAdmin(key, async (ctx) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.advertisers.verifyAsync(ctx.params.id, b.approve === true));
    }));
    r.add('GET', '/api/admin/listings', withAdmin(key, async () => fromResult(await c.listings.listAllAsync())));
    r.add('POST', '/api/admin/listings/:id/approve', withAdmin(key, async (ctx) => fromResult(await c.listings.approveAsync(ctx.params.id))));
    r.add('POST', '/api/admin/listings/:id/reject', withAdmin(key, async (ctx) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.listings.rejectAsync(ctx.params.id, str(b.reason)));
    }));
    r.add('POST', '/api/admin/listings/:id/end', withAdmin(key, async (ctx) => fromResult(await c.listings.forceEndAsync(ctx.params.id))));
    r.add('GET', '/api/admin/revenue', withAdmin(key, async () => fromResult(await c.billing.revenueAsync())));
    r.add('GET', '/api/admin/proposals', withAdmin(key, async () => fromResult(await c.proposals.listAllAsync())));
    r.add('POST', '/api/admin/proposals/:id/status', withAdmin(key, async (ctx) =>
    {
        const b = await bodyOf(ctx);
        return fromResult(await c.proposals.setStatusAsync(ctx.params.id, str(b.status) as ProposalStatus));
    }));
    const perkInputOf = (b: Record<string, unknown>): PerkInput => ({
        kind: str(b.kind) as PerkKind,
        action: (b.action === 'link' ? 'link' : 'request') as PerkAction,
        url: str(b.url),
        providerKo: str(b.providerKo),
        providerEn: str(b.providerEn),
        titleKo: str(b.titleKo),
        titleEn: str(b.titleEn),
        descKo: str(b.descKo),
        descEn: str(b.descEn),
        active: b.active !== false,
    });
    r.add('GET', '/api/admin/perks', withAdmin(key, async () => fromResult(await c.perks.listAllAsync())));
    r.add('GET', '/api/admin/perk-requests', withAdmin(key, async () => fromResult(await c.perks.listRequestsAsync())));
    r.add('POST', '/api/admin/perks', withAdmin(key, async (ctx) => fromResult(await c.perks.createAsync(perkInputOf(await bodyOf(ctx))), undefined, 201)));
    r.add('PUT', '/api/admin/perks/:id', withAdmin(key, async (ctx) => fromResult(await c.perks.updateAsync(ctx.params.id, perkInputOf(await bodyOf(ctx))))));
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

    return r;
}

export { BadRequestError };
