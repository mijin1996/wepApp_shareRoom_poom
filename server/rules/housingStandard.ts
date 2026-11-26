// 최저주거기준 규칙 (POL_ROOM_01 · 02) — 순수 계산만, 저장소 · 화면을 모른다
import type { Child } from '../models/people';

// 국토교통부 최저주거기준 가구원 수별 최소 총면적(㎡)
const MIN_AREA_BY_SIZE: Readonly<Record<number, number>> = {
    1: 14,
    2: 26,
    3: 36,
    4: 43,
    5: 46,
};
export const MAX_SHARE_HOUSEHOLD = 5;          // 6인 이상은 상담 (POL_ROOM_05)
const AGE_SEPARATE_FROM_PARENT = 6;            // 만 6세 이상 자녀는 부모와 다른 침실
const AGE_SEPARATE_OPPOSITE_SEX = 8;           // 만 8세 이상 이성 자녀끼리 분리

function minAgeOf(child: Child): number
{
    return Number(child.ageBand.split('-')[0]);
}

export function householdSize(children: readonly Child[]): number
{
    return 1 + children.length;
}

// 필요한 침실 수: 부모 1 + (6세 이상 자녀 방 0 ~ 2)
export function requiredBedrooms(children: readonly Child[]): number
{
    const older = children.filter((c) => minAgeOf(c) >= AGE_SEPARATE_FROM_PARENT);
    if (older.length === 0)
    {
        return 1;
    }
    const hasOlderBoy = older.some((c) => c.gender === 'm' && minAgeOf(c) >= AGE_SEPARATE_OPPOSITE_SEX);
    const hasOlderGirl = older.some((c) => c.gender === 'f' && minAgeOf(c) >= AGE_SEPARATE_OPPOSITE_SEX);
    const childRooms = hasOlderBoy && hasOlderGirl ? 2 : 1;
    return 1 + childRooms;
}

export function minAreaFor(size: number): number
{
    if (size > MAX_SHARE_HOUSEHOLD)
    {
        return Number.POSITIVE_INFINITY;
    }
    return MIN_AREA_BY_SIZE[Math.max(1, size)];
}

// 가구 면적 = 전용 + 공용 ÷ 하우스 가구 수 (POL_ROOM_03)
export function householdArea(privateM2: number, sharedM2: number, households: number): number
{
    return privateM2 + sharedM2 / Math.max(1, households);
}

// 이 면적이면 몇 명까지 살 수 있나 (2 ~ 5)
export function maxHouseholdForArea(area: number): number
{
    let max = 1;
    for (let size = 2; size <= MAX_SHARE_HOUSEHOLD; size++)
    {
        if (area >= MIN_AREA_BY_SIZE[size])
        {
            max = size;
        }
    }
    return max;
}

export type FitResult = 'fits' | 'too_small' | 'household_too_large';

export function checkFit(bedrooms: number, area: number, children: readonly Child[]): FitResult
{
    const size = householdSize(children);
    if (size > MAX_SHARE_HOUSEHOLD)
    {
        return 'household_too_large';
    }
    if (bedrooms < requiredBedrooms(children) || area < minAreaFor(size))
    {
        return 'too_small';
    }
    return 'fits';
}
