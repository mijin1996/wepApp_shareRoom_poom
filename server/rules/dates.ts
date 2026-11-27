// 날짜 계산 (YYYY-MM-DD, UTC 기준) — 광고 기간 · 구독 기간
const DAY_MS = 24 * 60 * 60 * 1000;

export function dayOf(date: Date): string
{
    return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string
{
    return dayOf(new Date(Date.parse(day + 'T00:00:00Z') + days * DAY_MS));
}

// 아직 기간이 남았나 ('' = 기간 없음 → 남은 것으로 봄)
export function isOpen(until: string, today: string): boolean
{
    return until === '' || until >= today;
}

// 연장: 남은 기간이 있으면 그 뒤에 이어 붙이고, 끝났으면 오늘부터
export function extend(until: string, today: string, days: number): string
{
    const base = until !== '' && until >= today ? until : today;
    return addDays(base, days);
}
