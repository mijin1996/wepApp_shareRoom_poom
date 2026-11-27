// RoomService: 방 찾기 규칙 (가족 맞춤 · 필터 · 위치 보호 · 광고 기간 · 상단 노출) — REQ_001 · 024 · 032 · 033, POL_AD_06 · 09
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { AdvertiserKind, BuildingType, House, HouseType, LatLng, PoiKind, Room, RoomProduct, RoomStatus } from '../models/housing';
import { dayOf, isOpen } from '../rules/dates';
import type { Child } from '../models/people';
import type { IHousingRepository } from '../repositories/housingRepository';
import { checkFit, householdArea, maxHouseholdForArea, type FitResult } from '../rules/housingStandard';
import { distanceMeters, walkMinutesRounded } from '../rules/walk';
import type { IClock } from '../adapters/adapters';

const NEAR_PLACE_METERS = 1500;          // 역 · 학교 검색 반경
const MOVE_IN_SOON_DAYS = 7;             // "바로 입주" = 7일 안
const DAY_MS = 24 * 60 * 60 * 1000;

export type RoomSort = 'soon' | 'cheap' | 'near';

export interface RoomQuery
{
    readonly placeId?: string;
    readonly houseType?: HouseType;
    readonly maxDeposit?: number;
    readonly maxMonthly?: number;
    readonly moveIn?: string;
    readonly soon?: boolean;
    readonly noStairs?: boolean;
    readonly privateBath?: boolean;
    readonly playroom?: boolean;
    readonly parking?: boolean;
    readonly foreignerOk?: boolean;
    readonly englishStaff?: boolean;
    readonly nearPoi?: PoiKind;
    readonly children: readonly Child[];
    readonly sort?: RoomSort;
}

export interface PoiView
{
    readonly kind: PoiKind;
    readonly nameKo: string;
    readonly nameEn: string;
    readonly walkMin: number;
}

// 화면에 보내는 방 정보: 정확한 위치 · 주소 · 출입 정보 없음 (POL_SEARCH_01)
export interface RoomView
{
    readonly roomId: string;
    readonly houseId: string;
    readonly houseNameKo: string;
    readonly houseNameEn: string;
    readonly houseType: HouseType;
    readonly guKo: string;
    readonly guEn: string;
    readonly dongKo: string;
    readonly dongEn: string;
    readonly dongCenter: LatLng;
    readonly product: RoomProduct;
    readonly bedrooms: number;
    readonly areaM2: number;
    readonly maxHousehold: number;
    readonly privateBath: boolean;
    readonly deposit: number;
    readonly rent: number;
    readonly fee: number;
    readonly monthly: number;
    readonly firstPayment: number;
    readonly moveOutCleaningFee: number;
    readonly minMonths: number;
    readonly maxMonths: number;
    readonly availableFrom: string;
    readonly availableSoon: boolean;
    readonly status: RoomStatus;
    readonly fit: FitResult | 'unknown';
    readonly buildingType: BuildingType;
    readonly elevator: boolean;
    readonly noStairs: boolean;
    readonly playroom: boolean;
    readonly parking: boolean;
    readonly foreignerOk: boolean;
    readonly englishStaff: boolean;
    readonly rulesKo: readonly string[];
    readonly rulesEn: readonly string[];
    readonly pois: readonly PoiView[];
    readonly placeWalkMin: number | undefined;
    // 광고 정보: 누가 올렸는지 (계약은 이 사람과 직접)
    readonly listedBy: AdvertiserKind;
    readonly advertiserNameKo: string;
    readonly advertiserNameEn: string;
    readonly agentRegNo: string;
    readonly noteKo: string;
    readonly noteEn: string;
    readonly featured: boolean;           // 상단 노출 중
    readonly example: boolean;
}

export interface MapCluster
{
    readonly dongKo: string;
    readonly dongEn: string;
    readonly guKo: string;
    readonly center: LatLng;
    readonly minMonthly: number;
    readonly vacantCount: number;
}

export class RoomService
{
    private readonly _housing: IHousingRepository;
    private readonly _clock: IClock;

    public constructor(housing: IHousingRepository, clock: IClock)
    {
        this._housing = housing;
        this._clock = clock;
    }

    private today(): string
    {
        return dayOf(this._clock.now());
    }

    // 광고 기간이 끝난 집은 방 찾기 · 상세에서 안 보임
    private isLive(house: House): boolean
    {
        return isOpen(house.listing.liveUntil, this.today());
    }

    private isSoon(availableFrom: string): boolean
    {
        return Date.parse(availableFrom) - this._clock.now().getTime() <= MOVE_IN_SOON_DAYS * DAY_MS;
    }

    public toView(room: Room, house: House, children: readonly Child[], placeLocation?: LatLng): RoomView
    {
        const area = householdArea(room.privateM2, house.sharedM2, house.households);
        return {
            roomId: room.id,
            houseId: house.id,
            houseNameKo: house.nameKo,
            houseNameEn: house.nameEn,
            houseType: house.type,
            guKo: house.gu,
            guEn: house.guEn,
            dongKo: house.dong,
            dongEn: house.dongEn,
            dongCenter: house.dongCenter,
            product: room.product,
            bedrooms: room.bedrooms,
            areaM2: Math.round(area),
            maxHousehold: maxHouseholdForArea(area),
            privateBath: room.privateBath,
            deposit: room.deposit,
            rent: room.rent,
            fee: room.fee,
            monthly: room.rent + room.fee,
            firstPayment: room.deposit + room.rent + room.fee,
            moveOutCleaningFee: house.moveOutCleaningFee,
            minMonths: house.minMonths,
            maxMonths: house.maxMonths,
            availableFrom: room.availableFrom,
            availableSoon: room.status === 'vacant' && this.isSoon(room.availableFrom),
            status: room.status,
            fit: children.length === 0 ? 'unknown' : checkFit(room.bedrooms, area, children),
            buildingType: house.buildingType,
            elevator: house.elevator,
            noStairs: house.noStairs,
            playroom: house.playroom,
            parking: house.parking,
            foreignerOk: house.foreignerOk,
            englishStaff: house.englishStaff,
            rulesKo: house.rulesKo,
            rulesEn: house.rulesEn,
            pois: house.pois
                .map((p) => ({ kind: p.kind, nameKo: p.nameKo, nameEn: p.nameEn, walkMin: walkMinutesRounded(house.location, p.location) }))
                .sort((a, b) => a.walkMin - b.walkMin),
            placeWalkMin: placeLocation ? walkMinutesRounded(house.location, placeLocation) : undefined,
            listedBy: house.listing.listedBy,
            advertiserNameKo: house.listing.advertiserNameKo,
            advertiserNameEn: house.listing.advertiserNameEn,
            agentRegNo: house.listing.agentRegNo,
            noteKo: house.listing.noteKo,
            noteEn: house.listing.noteEn,
            featured: house.listing.topUntil !== '' && house.listing.topUntil >= this.today(),
            example: house.listing.example,
        };
    }

    private async loadAsync(): Promise<Result<{ rooms: Room[]; houses: Map<string, House> }>>
    {
        const [rooms, houses] = await Promise.all([this._housing.getRoomsAsync(), this._housing.getHousesAsync()]);
        if (!rooms.ok)
        {
            return rooms;
        }
        if (!houses.ok)
        {
            return houses;
        }
        return success({ rooms: rooms.data, houses: new Map(houses.data.map((h) => [h.id, h])) });
    }

    public async searchAsync(query: RoomQuery): Promise<Result<RoomView[]>>
    {
        const loaded = await this.loadAsync();
        if (!loaded.ok)
        {
            return loaded;
        }

        let placeMatch: ((house: House) => boolean) | undefined;
        let placeLocation: LatLng | undefined;
        if (query.placeId?.startsWith('house:'))
        {
            // 하우스 이름으로 고른 경우
            const houseId = query.placeId.slice('house:'.length);
            placeMatch = (house) => house.id === houseId;
        }
        else if (query.placeId)
        {
            const places = await this._housing.getPlacesAsync();
            if (!places.ok)
            {
                return places;
            }
            const place = places.data.find((p) => p.id === query.placeId);
            if (!place)
            {
                return failure(AppError.NotFound);
            }
            placeLocation = place.kind === 'gu' || place.kind === 'dong' ? undefined : place.location;
            placeMatch = (house) =>
            {
                if (place.kind === 'gu')
                {
                    return house.gu === place.gu;
                }
                if (place.kind === 'dong')
                {
                    return house.dong === place.nameKo;
                }
                return distanceMeters(house.location, place.location) <= NEAR_PLACE_METERS;
            };
        }

        const views = loaded.data.rooms
            .filter((room) => room.status !== 'occupied')
            .map((room) => ({ room, house: loaded.data.houses.get(room.houseId) }))
            .filter((x): x is { room: Room; house: House } => x.house !== undefined && this.isLive(x.house))
            .filter(({ house }) => !placeMatch || placeMatch(house))
            .filter(({ house }) => !query.houseType || house.type === query.houseType)
            .filter(({ room }) => query.maxDeposit === undefined || room.deposit <= query.maxDeposit)
            .filter(({ room }) => query.maxMonthly === undefined || room.rent + room.fee <= query.maxMonthly)
            .filter(({ room }) => !query.moveIn || room.availableFrom <= query.moveIn)
            .filter(({ room }) => !query.soon || this.isSoon(room.availableFrom))
            .filter(({ room }) => !query.privateBath || room.privateBath)
            .filter(({ house }) => !query.noStairs || house.noStairs || house.elevator)
            .filter(({ house }) => !query.playroom || house.playroom)
            .filter(({ house }) => !query.parking || house.parking)
            .filter(({ house }) => !query.foreignerOk || house.foreignerOk)
            .filter(({ house }) => !query.englishStaff || house.englishStaff)
            .map(({ room, house }) => this.toView(room, house, query.children, placeLocation))
            .filter((view) => !query.nearPoi || view.pois.some((p) => p.kind === query.nearPoi && p.walkMin <= 10))
            .filter((view) => view.fit !== 'too_small' && view.fit !== 'household_too_large');

        // 상단 노출 광고가 먼저, 그 안에서는 고른 정렬 그대로 (POL_AD_09)
        const sorted = this.sort(views, query.sort ?? 'soon');
        return success([...sorted.filter((v) => v.featured), ...sorted.filter((v) => !v.featured)]);
    }

    private sort(views: RoomView[], sort: RoomSort): RoomView[]
    {
        const copy = [...views];
        if (sort === 'cheap')
        {
            return copy.sort((a, b) => a.monthly - b.monthly);
        }
        if (sort === 'near')
        {
            return copy.sort((a, b) => (a.placeWalkMin ?? 99) - (b.placeWalkMin ?? 99));
        }
        return copy.sort((a, b) => a.availableFrom.localeCompare(b.availableFrom));
    }

    public async getRoomAsync(roomId: string, children: readonly Child[]): Promise<Result<RoomView>>
    {
        const room = await this._housing.getRoomAsync(roomId);
        if (!room.ok)
        {
            return room;
        }
        const house = await this._housing.getHouseAsync(room.data.houseId);
        if (!house.ok)
        {
            return house;
        }
        return this.isLive(house.data) ? success(this.toView(room.data, house.data, children)) : failure(AppError.NotFound);
    }

    // 지도: 동 단위로만 묶는다 (POL_SEARCH_01)
    public async clustersAsync(query: RoomQuery): Promise<Result<MapCluster[]>>
    {
        const rooms = await this.searchAsync(query);
        if (!rooms.ok)
        {
            return rooms;
        }
        const byDong = new Map<string, MapCluster>();
        for (const view of rooms.data)
        {
            const key = view.guKo + view.dongKo;
            const prev = byDong.get(key);
            byDong.set(key, {
                dongKo: view.dongKo,
                dongEn: view.dongEn,
                guKo: view.guKo,
                center: view.dongCenter,
                minMonthly: prev ? Math.min(prev.minMonthly, view.monthly) : view.monthly,
                vacantCount: (prev?.vacantCount ?? 0) + (view.status === 'vacant' ? 1 : 0),
            });
        }
        return success([...byDong.values()]);
    }
}
