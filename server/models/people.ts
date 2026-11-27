// 사람 · 신청 · 계약 · 결제 Model
import type { Lang } from './housing';

export type Gender = 'f' | 'm';
export type AgeBand = '0-5' | '6-7' | '8-12' | '13-18' | '19-24';
export const AGE_BANDS: readonly AgeBand[] = ['0-5', '6-7', '8-12', '13-18', '19-24'];

// 자녀는 이름 · 생일 없이 나이대 · 성별만 (POL_PRIVACY_01)
export interface Child
{
    readonly ageBand: AgeBand;
    readonly gender: Gender;
}

export type IdType = 'kr' | 'alien';

export interface User
{
    readonly id: string;
    readonly name: string;
    readonly phone: string;
    readonly gender: Gender;
    readonly lang: Lang;
    readonly idType: IdType;
    readonly verified: boolean;       // 외국인 휴대폰 미인증이면 false (POL_MEMBER_04)
}

export type Urgency = 'now' | 'week' | 'month';
export const URGENCIES: readonly Urgency[] = ['now', 'week', 'month'];

// 문의 진행: 보냄 → 연락 옴 → 집 보기 → 계약함(광고주와 직접) / 닫힘 (POL_INQUIRY_03)
export type InquiryStatus = 'sent' | 'contacted' | 'viewing' | 'contracted' | 'closed';
export const INQUIRY_STATUSES: readonly InquiryStatus[] = ['sent', 'contacted', 'viewing', 'contracted', 'closed'];
export type DocType = 'resident_reg' | 'single_parent' | 'alien_reg';
export const DOC_TYPES: readonly DocType[] = ['resident_reg', 'single_parent', 'alien_reg'];

// 서류함: 한 번 올리면 문의마다 골라서 보냄 (POL_DOCBOX)
export interface DocumentBox
{
    readonly id: string;                   // = userId (사람당 하나)
    readonly docType: DocType;
    readonly uploadedAt: string;
    readonly checked: boolean;             // 운영 매니저가 확인 → "한부모 확인됨" 배지
}

export interface StatusStep
{
    readonly status: InquiryStatus;
    readonly at: string;
    readonly by: 'tenant' | 'advertiser';
}

// 문의: 한부모 가족 → 광고주. 품은 전달 · 기록만 하고 계약에 끼지 않음
export interface Inquiry
{
    readonly id: string;
    readonly userId: string;
    readonly roomId: string;
    readonly houseId: string;
    readonly advertiserId: string;
    readonly moveInDate: string;
    readonly months: number;
    readonly children: readonly Child[];
    readonly contactTime: string;
    readonly consultLang: Lang;
    readonly situation: string;            // 내 상황 (광고주에게 전달, 동의 받음)
    readonly urgency: Urgency | undefined;
    readonly status: InquiryStatus;
    readonly docShared: boolean;           // 서류함 서류를 이 광고주에게 보냈는지
    readonly history: readonly StatusStep[];
    readonly createdAt: string;
}

export type PayMethod = 'card' | 'transfer' | 'easy';
