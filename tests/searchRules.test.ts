// 검색 규칙: 초성 · 걸어서 ○분 (REQ_030, POL_SEARCH_02) — TC_032 · TC_033
import { describe, expect, it } from 'vitest';
import { matchesQuery, toChoseong } from '../server/rules/hangul';
import { walkMinutesRounded } from '../server/rules/walk';

describe('검색어 맞추기', () =>
{
    it('"마포구"의 초성은 "ㅁㅍㄱ"', () =>
    {
        expect(toChoseong('마포구')).toBe('ㅁㅍㄱ');
    });

    it('초성 "ㅁㅍ" 로 마포구를 찾는다', () =>
    {
        expect(matchesQuery('마포구', 'ㅁㅍ')).toBe(true);
    });

    it('영문 "mapo" 로 Mapo-gu 를 찾는다 (대소문자 무시)', () =>
    {
        expect(matchesQuery('Mapo-gu', 'MAPO')).toBe(true);
    });

    it('빈 검색어는 아무것도 찾지 않는다', () =>
    {
        expect(matchesQuery('마포구', '   ')).toBe(false);
    });
});

describe('걸어서 ○분', () =>
{
    it('같은 자리여도 최소 5분', () =>
    {
        expect(walkMinutesRounded([37.55, 126.9], [37.55, 126.9])).toBe(5);
    });

    it('항상 5분 단위', () =>
    {
        // Given: 망원동 하우스와 망원역
        const minutes = walkMinutesRounded([37.5571, 126.9046], [37.556, 126.9104]);

        // Then
        expect(minutes % 5).toBe(0);
        expect(minutes).toBeGreaterThanOrEqual(5);
    });
});
