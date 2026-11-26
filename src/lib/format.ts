// 금액 · 날짜 표시 (언어별)
import type { Lang } from '../i18n/i18n';

export function won(amount: number, lang: Lang): string
{
    if (lang === 'en')
    {
        return '₩' + amount.toLocaleString('en-US');
    }
    if (amount >= 10000 && amount % 10000 === 0)
    {
        return (amount / 10000).toLocaleString('ko-KR') + '만 원';
    }
    return amount.toLocaleString('ko-KR') + '원';
}

export function shortDate(iso: string, lang: Lang): string
{
    const date = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'ko-KR', { month: 'short', day: 'numeric' });
}

export function todayIso(): string
{
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function isToday(iso: string): boolean
{
    return iso <= todayIso();
}
