// 제휴 혜택 · 후원 · 기관 지원 Model (POL_PERK)
// partner = 이사 · 청소 · 가전 업체 할인 (업체가 품에 제휴 수수료), sponsor = 기업 후원, institution = 지자체 · 지원기관 프로그램
export type PerkKind = 'partner' | 'sponsor' | 'institution';
export const PERK_KINDS: readonly PerkKind[] = ['partner', 'sponsor', 'institution'];

// link = 제휴 업체 페이지로 이동, request = 품에 신청을 남기면 운영 매니저가 연결
export type PerkAction = 'link' | 'request';
export const PERK_ACTIONS: readonly PerkAction[] = ['link', 'request'];

export interface Perk
{
    readonly id: string;
    readonly kind: PerkKind;
    readonly action: PerkAction;
    readonly url: string;                  // action = link 일 때만 (https)
    readonly providerKo: string;
    readonly providerEn: string;
    readonly titleKo: string;
    readonly titleEn: string;
    readonly descKo: string;
    readonly descEn: string;
    readonly active: boolean;
    readonly example: boolean;
    readonly clicks: number;               // 제휴 정산 · 기관 보고용 이용 수
    readonly createdAt: string;
}

export interface PerkRequest
{
    readonly id: string;
    readonly perkId: string;
    readonly userId: string;
    readonly note: string;
    readonly createdAt: string;
}

// 문의 메뉴: 광고 · 제휴 · 후원 · 기관 제안 (POL_PROPOSAL)
export type ProposalKind = 'ad' | 'partner' | 'sponsor' | 'institution' | 'etc';
export const PROPOSAL_KINDS: readonly ProposalKind[] = ['ad', 'partner', 'sponsor', 'institution', 'etc'];
export type ProposalStatus = 'new' | 'in_progress' | 'done';
export const PROPOSAL_STATUSES: readonly ProposalStatus[] = ['new', 'in_progress', 'done'];

export interface Proposal
{
    readonly id: string;
    readonly kind: ProposalKind;
    readonly org: string;
    readonly name: string;
    readonly contact: string;
    readonly message: string;
    readonly status: ProposalStatus;
    readonly createdAt: string;
}
