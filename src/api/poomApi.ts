// API 모음 (Repository 역할): 화면은 이 함수들만 부르고 경로 · 모양은 몰라도 된다
import { requestAsync, type ApiResult } from './http';
import type { AdProductView, AdminQuestion, AdvertiserView, ChildDraft, CommunityTopic, DemandView, DocType, DocumentView, InquiryStatsView, InquiryStatus, InquiryView, ListingDraftView, ListingView, MapCluster, MetaView, NoticeDraft, NoticeView, PerkDraft, PerkKind, PerkView, ProductId, ProposalKind, ProposalView, QuestionDetail, QuestionSummaryView, ReceivedInquiryView, ReportView, RevenueView, RoomView, StatementView, Suggestion, TrailEntry, UserView } from './types';

export function childrenToQuery(children: readonly ChildDraft[]): string
{
    return children.map((c) => c.ageBand + c.gender).join(',');
}

export interface RoomFilters
{
    place?: string;
    type?: 'mom' | 'dad';
    maxDeposit?: number;
    maxMonthly?: number;
    moveIn?: string;
    soon?: boolean;
    noStairs?: boolean;
    privateBath?: boolean;
    playroom?: boolean;
    parking?: boolean;
    foreignerOk?: boolean;
    englishStaff?: boolean;
    near?: string;
    sort?: 'soon' | 'cheap' | 'near';
}

export function filtersToQuery(filters: RoomFilters, children: readonly ChildDraft[]): string
{
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
    {
        if (value === undefined || value === false || value === '')
        {
            continue;
        }
        params.set(key, value === true ? '1' : String(value));
    }
    if (children.length > 0)
    {
        params.set('children', childrenToQuery(children));
    }
    return params.toString();
}

export const poomApi = {
    meta: (): Promise<ApiResult<MetaView>> => requestAsync('/api/meta'),
    areas: (): Promise<ApiResult<Suggestion[]>> => requestAsync('/api/areas'),
    suggest: (q: string): Promise<ApiResult<Suggestion[]>> => requestAsync('/api/search/suggest?q=' + encodeURIComponent(q)),
    rooms: (query: string): Promise<ApiResult<RoomView[]>> => requestAsync('/api/rooms?' + query),
    clusters: (query: string): Promise<ApiResult<MapCluster[]>> => requestAsync('/api/rooms/map?' + query),
    room: (id: string, children: readonly ChildDraft[]): Promise<ApiResult<RoomView>> =>
        requestAsync(`/api/rooms/${encodeURIComponent(id)}?children=${childrenToQuery(children)}`),
    demand: (gu: string, householdSize: number, monthly?: number): Promise<ApiResult<{ ok: boolean }>> =>
        requestAsync('/api/demand', { method: 'POST', body: { gu, householdSize, monthly } }),
    adProducts: (): Promise<ApiResult<AdProductView[]>> => requestAsync('/api/ad-products'),
    propose: (body: { kind: ProposalKind; org: string; name: string; contact: string; message: string }): Promise<ApiResult<{ id: string }>> =>
        requestAsync('/api/proposals', { method: 'POST', body }),
    perks: (kind: PerkKind | ''): Promise<ApiResult<PerkView[]>> => requestAsync('/api/perks' + (kind ? '?kind=' + kind : '')),
    openPerk: (id: string): Promise<ApiResult<{ url: string }>> => requestAsync(`/api/perks/${encodeURIComponent(id)}/open`, { method: 'POST', body: {} }),
    requestPerk: (id: string, note: string): Promise<ApiResult<{ id: string }>> => requestAsync(`/api/perks/${encodeURIComponent(id)}/request`, { method: 'POST', body: { note } }),
    myPerkRequests: (): Promise<ApiResult<string[]>> => requestAsync('/api/me/perk-requests'),

    verify: (body: { name: string; phone: string; gender: string; idType: string; lang: string }): Promise<ApiResult<{ token: string; user: UserView }>> =>
        requestAsync('/api/auth/verify', { method: 'POST', body }),
    me: (): Promise<ApiResult<UserView>> => requestAsync('/api/me'),

    myInquiries: (): Promise<ApiResult<InquiryView[]>> => requestAsync('/api/me/inquiries'),
    inquire: (body: Record<string, unknown>): Promise<ApiResult<InquiryView>> => requestAsync('/api/inquiries', { method: 'POST', body }),
    shareDoc: (id: string): Promise<ApiResult<InquiryView>> => requestAsync(`/api/inquiries/${id}/share-document`, { method: 'POST', body: {} }),
    setInquiryStatus: (id: string, status: InquiryStatus): Promise<ApiResult<InquiryView>> => requestAsync(`/api/inquiries/${id}/status`, { method: 'POST', body: { status } }),
    myDocument: (): Promise<ApiResult<{ document: DocumentView | null }>> => requestAsync('/api/me/document'),
    uploadDoc: (docType: DocType): Promise<ApiResult<DocumentView>> => requestAsync('/api/me/document', { method: 'POST', body: { docType } }),

    advertiser: {
        me: (): Promise<ApiResult<{ advertiser: AdvertiserView | null }>> => requestAsync('/api/advertiser/me'),
        register: (body: { kind: string; nameKo: string; nameEn: string; agentRegNo: string; ownershipDoc: boolean }): Promise<ApiResult<AdvertiserView>> =>
            requestAsync('/api/advertiser', { method: 'POST', body }),
        listings: (): Promise<ApiResult<ListingView[]>> => requestAsync('/api/advertiser/listings'),
        submit: (draft: ListingDraftView): Promise<ApiResult<ListingView>> => requestAsync('/api/advertiser/listings', { method: 'POST', body: draft }),
        end: (id: string): Promise<ApiResult<ListingView>> => requestAsync(`/api/advertiser/listings/${id}/end`, { method: 'POST', body: {} }),
        buy: (productId: ProductId, listingId: string, method: string): Promise<ApiResult<{ id: string; amount: number }>> =>
            requestAsync('/api/advertiser/buy', { method: 'POST', body: { productId, listingId, method } }),
        statement: (): Promise<ApiResult<StatementView>> => requestAsync('/api/advertiser/statement'),
        settle: (method: string): Promise<ApiResult<{ total: number }>> => requestAsync('/api/advertiser/settle', { method: 'POST', body: { method } }),
        inquiries: (): Promise<ApiResult<ReceivedInquiryView[]>> => requestAsync('/api/advertiser/inquiries'),
        setStatus: (id: string, status: InquiryStatus): Promise<ApiResult<InquiryView>> =>
            requestAsync(`/api/advertiser/inquiries/${id}/status`, { method: 'POST', body: { status } }),
    },

    favorites: (): Promise<ApiResult<string[]>> => requestAsync('/api/me/favorites'),
    toggleFavorite: (roomId: string): Promise<ApiResult<{ on: boolean }>> => requestAsync(`/api/me/favorites/${roomId}`, { method: 'POST', body: {} }),
    savedSearches: (): Promise<ApiResult<{ id: string; query: string }[]>> => requestAsync('/api/me/saved-searches'),
    saveSearch: (query: string): Promise<ApiResult<{ id: string }>> => requestAsync('/api/me/saved-searches', { method: 'POST', body: { query } }),
    deleteSearch: (id: string): Promise<ApiResult<{ ok: boolean }>> => requestAsync(`/api/me/saved-searches/${id}`, { method: 'DELETE' }),

    report: (body: { clientKey: string; kind: string; message: string; screenId: string; shot?: string; trail: TrailEntry[]; env: Record<string, string>; channel: string; version: string; lang: string }): Promise<ApiResult<{ id: string }>> =>
        requestAsync('/api/report', { method: 'POST', body }),
    myReports: (): Promise<ApiResult<ReportView[]>> => requestAsync('/api/me/reports'),
    confirmReport: (id: string, resolved: boolean): Promise<ApiResult<{ ok: boolean }>> =>
        requestAsync(`/api/me/reports/${id}/confirm`, { method: 'POST', body: { resolved } }),

    notices: (): Promise<ApiResult<NoticeView[]>> => requestAsync('/api/notices'),
    notice: (id: string): Promise<ApiResult<NoticeView>> => requestAsync('/api/notices/' + encodeURIComponent(id)),

    community: {
        list: (topic: CommunityTopic | '', q: string): Promise<ApiResult<QuestionSummaryView[]>> =>
            requestAsync('/api/community?' + new URLSearchParams({ ...(topic ? { topic } : {}), ...(q ? { q } : {}) }).toString()),
        get: (id: string): Promise<ApiResult<QuestionDetail>> => requestAsync('/api/community/' + encodeURIComponent(id)),
        ask: (body: { topic: CommunityTopic; title: string; body: string; lang: string }): Promise<ApiResult<{ id: string }>> =>
            requestAsync('/api/community', { method: 'POST', body }),
        answer: (id: string, body: string): Promise<ApiResult<{ id: string }>> =>
            requestAsync(`/api/community/${encodeURIComponent(id)}/answers`, { method: 'POST', body: { body } }),
        solve: (id: string, answerId: string): Promise<ApiResult<{ ok: boolean }>> =>
            requestAsync(`/api/community/${encodeURIComponent(id)}/solve`, { method: 'POST', body: { answerId } }),
        flag: (id: string, answerId?: string): Promise<ApiResult<{ hidden: boolean }>> =>
            requestAsync(`/api/community/${encodeURIComponent(id)}/flag`, { method: 'POST', body: { answerId: answerId ?? '' } }),
    },

    admin: {
        notices: (): Promise<ApiResult<NoticeView[]>> => requestAsync('/api/admin/notices', { admin: true }),
        createNotice: (body: NoticeDraft): Promise<ApiResult<NoticeView>> => requestAsync('/api/admin/notices', { method: 'POST', body, admin: true }),
        updateNotice: (id: string, body: NoticeDraft): Promise<ApiResult<NoticeView>> =>
            requestAsync(`/api/admin/notices/${encodeURIComponent(id)}`, { method: 'PUT', body, admin: true }),
        community: (): Promise<ApiResult<AdminQuestion[]>> => requestAsync('/api/admin/community', { admin: true }),
        officialAnswer: (id: string, body: string): Promise<ApiResult<{ id: string }>> =>
            requestAsync(`/api/admin/community/${id}/answers`, { method: 'POST', body: { body }, admin: true }),
        setHidden: (id: string, hidden: boolean, answerId?: string): Promise<ApiResult<{ ok: boolean }>> =>
            requestAsync(`/api/admin/community/${id}/hidden`, { method: 'POST', body: { hidden, answerId: answerId ?? '' }, admin: true }),
        inquiries: (): Promise<ApiResult<InquiryView[]>> => requestAsync('/api/admin/inquiries', { admin: true }),
        stats: (): Promise<ApiResult<InquiryStatsView>> => requestAsync('/api/admin/stats', { admin: true }),
        documents: (): Promise<ApiResult<DocumentView[]>> => requestAsync('/api/admin/documents', { admin: true }),
        checkDoc: (userId: string): Promise<ApiResult<DocumentView>> => requestAsync(`/api/admin/documents/${userId}/check`, { method: 'POST', body: {}, admin: true }),
        advertisers: (): Promise<ApiResult<AdvertiserView[]>> => requestAsync('/api/admin/advertisers', { admin: true }),
        verifyAdvertiser: (id: string, approve: boolean): Promise<ApiResult<AdvertiserView>> =>
            requestAsync(`/api/admin/advertisers/${id}/verify`, { method: 'POST', body: { approve }, admin: true }),
        listings: (): Promise<ApiResult<ListingView[]>> => requestAsync('/api/admin/listings', { admin: true }),
        approveListing: (id: string): Promise<ApiResult<ListingView>> => requestAsync(`/api/admin/listings/${id}/approve`, { method: 'POST', body: {}, admin: true }),
        rejectListing: (id: string, reason: string): Promise<ApiResult<ListingView>> =>
            requestAsync(`/api/admin/listings/${id}/reject`, { method: 'POST', body: { reason }, admin: true }),
        endListing: (id: string): Promise<ApiResult<ListingView>> => requestAsync(`/api/admin/listings/${id}/end`, { method: 'POST', body: {}, admin: true }),
        revenue: (): Promise<ApiResult<RevenueView[]>> => requestAsync('/api/admin/revenue', { admin: true }),
        proposals: (): Promise<ApiResult<ProposalView[]>> => requestAsync('/api/admin/proposals', { admin: true }),
        setProposalStatus: (id: string, status: string): Promise<ApiResult<ProposalView>> =>
            requestAsync(`/api/admin/proposals/${id}/status`, { method: 'POST', body: { status }, admin: true }),
        perks: (): Promise<ApiResult<{ perk: PerkView; requests: number }[]>> => requestAsync('/api/admin/perks', { admin: true }),
        createPerk: (body: PerkDraft): Promise<ApiResult<PerkView>> => requestAsync('/api/admin/perks', { method: 'POST', body, admin: true }),
        updatePerk: (id: string, body: PerkDraft): Promise<ApiResult<PerkView>> =>
            requestAsync(`/api/admin/perks/${encodeURIComponent(id)}`, { method: 'PUT', body, admin: true }),
        reports: (): Promise<ApiResult<ReportView[]>> => requestAsync('/api/admin/reports', { admin: true }),
        updateReport: (id: string, body: Record<string, unknown>): Promise<ApiResult<ReportView>> =>
            requestAsync(`/api/admin/reports/${id}`, { method: 'PATCH', body, admin: true }),
        reply: (id: string, message: string): Promise<ApiResult<ReportView>> =>
            requestAsync(`/api/admin/reports/${id}/reply`, { method: 'POST', body: { message }, admin: true }),
        demand: (): Promise<ApiResult<DemandView[]>> => requestAsync('/api/admin/demand', { admin: true }),
    },
};
