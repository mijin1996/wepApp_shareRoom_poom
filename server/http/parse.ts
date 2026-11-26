// 요청 값 읽기: 밖에서 온 값은 믿지 않고 하나씩 확인한다
import type { HouseType, PoiKind } from '../models/housing';
import { AGE_BANDS, type AgeBand, type Child } from '../models/people';
import type { RoomQuery, RoomSort } from '../services/roomService';

const MAX_CHILDREN = 8;
const POI_KINDS: readonly PoiKind[] = ['school_e', 'school_m', 'school_h', 'daycare', 'station', 'pediatric', 'mart'];

// "8-12m,13-18f" → [{ ageBand: '8-12', gender: 'm' }, ...]
export function parseChildren(raw: string | null | undefined): Child[]
{
    if (!raw)
    {
        return [];
    }
    return raw.split(',').slice(0, MAX_CHILDREN).flatMap((token) =>
    {
        const match = /^(\d+-\d+)([mf])$/.exec(token.trim());
        if (!match || !AGE_BANDS.includes(match[1] as AgeBand))
        {
            return [];
        }
        return [{ ageBand: match[1] as AgeBand, gender: match[2] as Child['gender'] }];
    });
}

function num(value: string | null): number | undefined
{
    if (value === null || value === '')
    {
        return undefined;
    }
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function flag(value: string | null): boolean
{
    return value === '1' || value === 'true';
}

export function parseRoomQuery(params: URLSearchParams): RoomQuery
{
    const houseType = params.get('type');
    const sort = params.get('sort');
    const nearPoi = params.get('near');
    const moveIn = params.get('moveIn');
    return {
        placeId: params.get('place') ?? undefined,
        houseType: houseType === 'mom' || houseType === 'dad' ? (houseType as HouseType) : undefined,
        maxDeposit: num(params.get('maxDeposit')),
        maxMonthly: num(params.get('maxMonthly')),
        moveIn: moveIn && /^\d{4}-\d{2}-\d{2}$/.test(moveIn) ? moveIn : undefined,
        soon: flag(params.get('soon')),
        noStairs: flag(params.get('noStairs')),
        privateBath: flag(params.get('privateBath')),
        playroom: flag(params.get('playroom')),
        parking: flag(params.get('parking')),
        foreignerOk: flag(params.get('foreignerOk')),
        englishStaff: flag(params.get('englishStaff')),
        nearPoi: POI_KINDS.includes(nearPoi as PoiKind) ? (nearPoi as PoiKind) : undefined,
        children: parseChildren(params.get('children')),
        sort: sort === 'cheap' || sort === 'near' ? (sort as RoomSort) : 'soon',
    };
}

export function str(value: unknown, fallback = ''): string
{
    return typeof value === 'string' ? value : fallback;
}

export function int(value: unknown, fallback = 0): number
{
    return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
}
