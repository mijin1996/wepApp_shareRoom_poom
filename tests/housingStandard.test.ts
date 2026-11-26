// POL_ROOM_01 · 02 최저주거기준 — TC_022
import { describe, expect, it } from 'vitest';
import { checkFit, householdArea, maxHouseholdForArea, requiredBedrooms } from '../server/rules/housingStandard';
import type { Child } from '../server/models/people';

const boy = (band: Child['ageBand']): Child => ({ ageBand: band, gender: 'm' });
const girl = (band: Child['ageBand']): Child => ({ ageBand: band, gender: 'f' });

describe('필요한 침실 수', () =>
{
    it('부모 + 5살 → 침실 1 (6세 미만은 부모와 같은 방)', () =>
    {
        // Given
        const children = [boy('0-5')];

        // When
        const rooms = requiredBedrooms(children);

        // Then
        expect(rooms).toBe(1);
    });

    it('부모 + 7살 → 침실 2 (6세 이상은 부모와 분리)', () =>
    {
        expect(requiredBedrooms([girl('6-7')])).toBe(2);
    });

    it('부모 + 9살 아들 + 10살 딸 → 침실 3 (8세 이상 남매 분리)', () =>
    {
        expect(requiredBedrooms([boy('8-12'), girl('8-12')])).toBe(3);
    });

    it('부모 + 9살 · 10살 형제 → 침실 2 (동성은 같은 방 가능)', () =>
    {
        expect(requiredBedrooms([boy('8-12'), boy('8-12')])).toBe(2);
    });

    it('경계: 8세 이상 아들 + 6~7세 딸 → 침실 2 (7세 딸은 아직 분리 안 해도 됨)', () =>
    {
        expect(requiredBedrooms([boy('8-12'), girl('6-7')])).toBe(2);
    });

    it('자녀가 없으면 침실 1', () =>
    {
        expect(requiredBedrooms([])).toBe(1);
    });
});

describe('면적과 가구원 수', () =>
{
    it('전용 16㎡ + 공용 40㎡ ÷ 4가구 = 26㎡ → 2인까지', () =>
    {
        // Given
        const area = householdArea(16, 40, 4);

        // When
        const max = maxHouseholdForArea(area);

        // Then
        expect(area).toBe(26);
        expect(max).toBe(2);
    });

    it('경계: 35.9㎡ 는 3인 기준(36㎡) 미만 → 2인까지', () =>
    {
        expect(maxHouseholdForArea(35.9)).toBe(2);
    });

    it('48㎡ → 5인까지', () =>
    {
        expect(maxHouseholdForArea(48)).toBe(5);
    });
});

describe('방이 가족에 맞는지', () =>
{
    it('침실 2 · 36㎡ 방에 엄마 + 9살 아들 + 11살 딸 → 작음 (침실 3 필요)', () =>
    {
        expect(checkFit(2, 36, [boy('8-12'), girl('8-12')])).toBe('too_small');
    });

    it('침실 3 · 44㎡ 방에 같은 가족 → 맞음', () =>
    {
        expect(checkFit(3, 44, [boy('8-12'), girl('8-12')])).toBe('fits');
    });

    it('자녀 5명(6인 가구) → 상담 (POL_ROOM_05)', () =>
    {
        const five = [boy('0-5'), boy('0-5'), girl('0-5'), girl('0-5'), boy('0-5')];
        expect(checkFit(4, 100, five)).toBe('household_too_large');
    });
});
