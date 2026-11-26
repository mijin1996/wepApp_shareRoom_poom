// TC_014: 한국어 · 영어 문구 키가 하나라도 다르면 실패
import { describe, expect, it } from 'vitest';
import ko from '../src/i18n/ko.json';
import en from '../src/i18n/en.json';

describe('문구 시트', () =>
{
    it('한국어와 영어 키가 똑같다', () =>
    {
        // Given
        const koKeys = Object.keys(ko).sort();
        const enKeys = Object.keys(en).sort();

        // Then
        expect(enKeys).toEqual(koKeys);
    });

    it('빈 문구가 없다', () =>
    {
        const empty = [...Object.entries(ko), ...Object.entries(en)].filter(([, v]) => String(v).trim() === '');
        expect(empty).toEqual([]);
    });

    it('변수 {이름} 모양이 두 언어에서 같다', () =>
    {
        const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
        const mismatched = Object.keys(ko).filter((k) => vars((ko as Record<string, string>)[k]) !== vars((en as Record<string, string>)[k]));
        expect(mismatched).toEqual([]);
    });
});
