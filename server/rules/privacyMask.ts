// 글에 적힌 연락처 · 주민번호 · 이메일을 가린다 (POL_COMMUNITY_03) — 아이 · 가족 안전
const PHONE = /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g;
const RESIDENT_NO = /\d{6}[-\s]?[1-8]\d{6}/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const MASK = '***';

export function maskPrivate(text: string): string
{
    return text.replace(RESIDENT_NO, MASK).replace(PHONE, MASK).replace(EMAIL, MASK);
}

export function hasPrivate(text: string): boolean
{
    return maskPrivate(text) !== text;
}
