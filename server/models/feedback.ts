// 의견 · 신고 · 수요 · 관심 Model
import type { Lang } from './housing';

export type ReportKind = 'bug' | 'usability' | 'house' | 'payment' | 'safety' | 'idea';
export const REPORT_KINDS: readonly ReportKind[] = ['bug', 'usability', 'house', 'payment', 'safety', 'idea'];
export type ReportStatus = 'received' | 'checking' | 'in_progress' | 'done' | 'on_hold' | 'duplicate';
export type Severity = 'critical' | 'high' | 'normal' | 'low';
export type Priority = 'P1' | 'P2' | 'P3';

export interface TrailEntry
{
    readonly at: number;              // ms
    readonly kind: string;            // 'error' | 'click' | 'screen'
    readonly text: string;
    readonly count: number;
}

export interface StatusLog
{
    readonly from: ReportStatus;
    readonly to: ReportStatus;
    readonly by: string;
    readonly at: string;
}

export interface Resolution
{
    readonly cause: string;
    readonly fix: string;
    readonly verify: string;
}

export interface Report
{
    readonly id: string;
    readonly userId: string | undefined;
    readonly clientKey: string;
    readonly kind: ReportKind;
    readonly message: string;
    readonly screenId: string;
    readonly shot: string | undefined;    // Mock: 메모리, Real: R2 키
    readonly trail: readonly TrailEntry[];
    readonly env: Readonly<Record<string, string>>;
    readonly channel: string;
    readonly version: string;
    readonly lang: Lang;
    readonly status: ReportStatus;
    readonly severity: Severity | undefined;
    readonly priority: Priority | undefined;
    readonly resolution: Resolution | undefined;
    readonly statusLog: readonly StatusLog[];
    readonly replies: readonly string[];
    readonly resolvedByReporter: boolean | undefined;
    readonly createdAt: string;
}

export interface DemandStat
{
    readonly id: string;                  // gu|size|band
    readonly gu: string;
    readonly householdSize: number;
    readonly priceBand: string;
    readonly count: number;
}

export interface Favorite
{
    readonly id: string;                  // userId|roomId
    readonly userId: string;
    readonly roomId: string;
}

export interface SavedSearch
{
    readonly id: string;
    readonly userId: string;
    readonly query: string;               // 지역 수준 조건만 (쿼리 문자열)
    readonly createdAt: string;
}

