// SearchService: 검색 추천 · 지역 수요 — REQ_030 · 036, POL_SEARCH_03 · 04
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { PlaceKind } from '../models/housing';
import type { DemandStat } from '../models/feedback';
import type { IHousingRepository } from '../repositories/housingRepository';
import type { IRecordRepository } from '../repositories/recordRepository';
import { dayOf, isOpen } from '../rules/dates';
import { matchesQuery } from '../rules/hangul';
import type { IClock } from '../adapters/adapters';

const MAX_PER_GROUP = 5;
const MAX_QUERY_LENGTH = 40;

export type SuggestKind = PlaceKind | 'house';

export interface Suggestion
{
    readonly id: string;
    readonly kind: SuggestKind;
    readonly nameKo: string;
    readonly nameEn: string;
    readonly guKo: string;
}

export interface DemandInput
{
    readonly gu: string;
    readonly householdSize: number;
    readonly monthly: number | undefined;
}

function priceBand(monthly: number | undefined): string
{
    if (monthly === undefined)
    {
        return 'any';
    }
    if (monthly <= 300000)
    {
        return '~30';
    }
    return monthly <= 400000 ? '30~40' : '40~';
}

export class SearchService
{
    private readonly _housing: IHousingRepository;
    private readonly _demand: IRecordRepository<DemandStat>;
    private readonly _clock: IClock;

    public constructor(housing: IHousingRepository, demand: IRecordRepository<DemandStat>, clock: IClock)
    {
        this._housing = housing;
        this._demand = demand;
        this._clock = clock;
    }

    // 광고 올릴 때 고르는 지역: 구 · 동만
    public async areasAsync(): Promise<Result<Suggestion[]>>
    {
        const places = await this._housing.getPlacesAsync();
        if (!places.ok)
        {
            return places;
        }
        return success(places.data
            .filter((p) => p.kind === 'gu' || p.kind === 'dong')
            .map((p) => ({ id: p.id, kind: p.kind, nameKo: p.nameKo, nameEn: p.nameEn, guKo: p.gu })));
    }

    public async suggestAsync(query: string): Promise<Result<Suggestion[]>>
    {
        const q = query.trim().slice(0, MAX_QUERY_LENGTH);
        if (q.length === 0)
        {
            return success([]);
        }
        const [places, houses] = await Promise.all([this._housing.getPlacesAsync(), this._housing.getHousesAsync()]);
        if (!places.ok)
        {
            return places;
        }
        if (!houses.ok)
        {
            return houses;
        }

        const placeHits: Suggestion[] = places.data
            .filter((p) => matchesQuery(p.nameKo, q) || matchesQuery(p.nameEn, q))
            .map((p) => ({ id: p.id, kind: p.kind, nameKo: p.nameKo, nameEn: p.nameEn, guKo: p.gu }));
        // 광고 기간이 끝난 집은 추천에서도 뺀다
        const today = dayOf(this._clock.now());
        const houseHits: Suggestion[] = houses.data
            .filter((h) => isOpen(h.listing.liveUntil, today))
            .filter((h) => matchesQuery(h.nameKo, q) || matchesQuery(h.nameEn, q))
            .map((h) => ({ id: 'house:' + h.id, kind: 'house' as const, nameKo: h.nameKo, nameEn: h.nameEn, guKo: h.gu }));

        // 종류마다 최대 5개
        const order: SuggestKind[] = ['gu', 'dong', 'station', 'school', 'daycare', 'house'];
        const grouped = order.flatMap((kind) => [...placeHits, ...houseHits].filter((s) => s.kind === kind).slice(0, MAX_PER_GROUP));
        return success(grouped);
    }

    // 0건 검색 · "생기면 알림"을 지역 수요로 센다. 개인 정보는 남기지 않는다
    public async recordDemandAsync(input: DemandInput): Promise<Result<DemandStat>>
    {
        if (!input.gu || input.householdSize < 2 || input.householdSize > 10)
        {
            return failure(AppError.InvalidInput);
        }
        const band = priceBand(input.monthly);
        const id = `${input.gu}|${input.householdSize}|${band}`;
        const prev = await this._demand.getAsync(id);
        const next: DemandStat = {
            id,
            gu: input.gu,
            householdSize: input.householdSize,
            priceBand: band,
            count: (prev.ok ? prev.data.count : 0) + 1,
        };
        return this._demand.saveAsync(next);
    }

    public async demandStatsAsync(): Promise<Result<DemandStat[]>>
    {
        const all = await this._demand.getAllAsync();
        return all.ok ? success([...all.data].sort((a, b) => b.count - a.count)) : all;
    }
}
