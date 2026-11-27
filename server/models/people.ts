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

export type ApplicationStatus = 'received' | 'approved' | 'on_hold' | 'rejected';
export type DocType = 'resident_reg' | 'single_parent' | 'alien_reg';

export interface DocumentInfo
{
    readonly docType: DocType;
    readonly uploadedAt: string;
    readonly checked: boolean;
}

export interface Application
{
    readonly id: string;
    readonly userId: string;
    readonly roomId: string;
    readonly moveInDate: string;
    readonly months: number;
    readonly children: readonly Child[];
    readonly contactTime: string;
    readonly consultLang: Lang;
    readonly situation: string;            // 내 상황 (운영 매니저만 봄, POL_APPLY_SITUATION)
    readonly urgency: Urgency | undefined; // 언제까지 집이 필요한지
    readonly status: ApplicationStatus;
    readonly document: DocumentInfo | undefined;
    readonly createdAt: string;
}

export interface Contract
{
    readonly id: string;
    readonly applicationId: string;
    readonly userId: string;
    readonly roomId: string;
    readonly startDate: string;
    readonly months: number;
    readonly deposit: number;
    readonly rent: number;
    readonly fee: number;
    readonly signedAt: string;
    readonly paid: boolean;
}

export type PayMethod = 'card' | 'transfer' | 'easy';

export interface Payment
{
    readonly id: string;
    readonly contractId: string;
    readonly amount: number;
    readonly method: PayMethod;
    readonly paidAt: string;
}
