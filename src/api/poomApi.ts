// API 모음 (Repository 역할): 화면은 이 함수들만 부르고 경로 · 모양은 몰라도 된다
import { requestAsync, type ApiResult } from './http';
import type { ApplicationView, ChildDraft, ContractView, DemandView, DocType, MapCluster, MetaView, MoveInView, PartnerView, ReportView, RoomView, Suggestion, TrailEntry, UserView } from './types';

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
    suggest: (q: string): Promise<ApiResult<Suggestion[]>> => requestAsync('/api/search/suggest?q=' + encodeURIComponent(q)),
    rooms: (query: string): Promise<ApiResult<RoomView[]>> => requestAsync('/api/rooms?' + query),
    clusters: (query: string): Promise<ApiResult<MapCluster[]>> => requestAsync('/api/rooms/map?' + query),
    room: (id: string, children: readonly ChildDraft[]): Promise<ApiResult<RoomView>> =>
        requestAsync(`/api/rooms/${encodeURIComponent(id)}?children=${childrenToQuery(children)}`),
    demand: (gu: string, householdSize: number, monthly?: number): Promise<ApiResult<{ ok: boolean }>> =>
        requestAsync('/api/demand', { method: 'POST', body: { gu, householdSize, monthly } }),
    partner: (body: { kind: string; gu: string; rooms: number; contact: string; message: string }): Promise<ApiResult<{ id: string }>> =>
        requestAsync('/api/partner', { method: 'POST', body }),

    verify: (body: { name: string; phone: string; birthYear: number; gender: string; idType: string; lang: string }): Promise<ApiResult<{ token: string; user: UserView }>> =>
        requestAsync('/api/auth/verify', { method: 'POST', body }),
    me: (): Promise<ApiResult<UserView>> => requestAsync('/api/me'),

    myApplications: (): Promise<ApiResult<ApplicationView[]>> => requestAsync('/api/me/applications'),
    apply: (body: Record<string, unknown>): Promise<ApiResult<ApplicationView>> => requestAsync('/api/applications', { method: 'POST', body }),
    uploadDoc: (appId: string, docType: DocType): Promise<ApiResult<ApplicationView>> =>
        requestAsync(`/api/applications/${appId}/documents`, { method: 'POST', body: { docType } }),
    sign: (appId: string, signature: string): Promise<ApiResult<ContractView>> =>
        requestAsync(`/api/applications/${appId}/sign`, { method: 'POST', body: { signature } }),
    myContracts: (): Promise<ApiResult<ContractView[]>> => requestAsync('/api/me/contracts'),
    pay: (contractId: string, method: string): Promise<ApiResult<{ id: string; amount: number }>> =>
        requestAsync(`/api/contracts/${contractId}/pay`, { method: 'POST', body: { method } }),
    moveIn: (): Promise<ApiResult<MoveInView>> => requestAsync('/api/me/movein'),

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

    admin: {
        applications: (): Promise<ApiResult<ApplicationView[]>> => requestAsync('/api/admin/applications', { admin: true }),
        decide: (id: string, decision: string): Promise<ApiResult<ApplicationView>> =>
            requestAsync(`/api/admin/applications/${id}/decision`, { method: 'POST', body: { decision }, admin: true }),
        checkDoc: (id: string): Promise<ApiResult<ApplicationView>> =>
            requestAsync(`/api/admin/applications/${id}/document-check`, { method: 'POST', body: {}, admin: true }),
        reports: (): Promise<ApiResult<ReportView[]>> => requestAsync('/api/admin/reports', { admin: true }),
        updateReport: (id: string, body: Record<string, unknown>): Promise<ApiResult<ReportView>> =>
            requestAsync(`/api/admin/reports/${id}`, { method: 'PATCH', body, admin: true }),
        reply: (id: string, message: string): Promise<ApiResult<ReportView>> =>
            requestAsync(`/api/admin/reports/${id}/reply`, { method: 'POST', body: { message }, admin: true }),
        demand: (): Promise<ApiResult<DemandView[]>> => requestAsync('/api/admin/demand', { admin: true }),
        partners: (): Promise<ApiResult<PartnerView[]>> => requestAsync('/api/admin/partners', { admin: true }),
    },
};
