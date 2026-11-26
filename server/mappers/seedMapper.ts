// Mapper: DTO → Model. 빈 값 · 이상한 값은 안전한 기본값으로 (개념편 5.2 방어적 변환)
import type { BuildingType, House, HouseType, LatLng, Place, PlaceKind, Poi, PoiKind, Room, RoomProduct, RoomStatus } from '../models/housing';
import type { HouseDto, PlaceDto, PoiDto, RoomDto } from '../dtos/seedDto';

const SEOUL_CITY_HALL: LatLng = [37.5665, 126.978];
const DEFAULT_MAX_MONTHS = 24;
const DEFAULT_HOUSEHOLDS = 1;

const POI_KINDS: readonly PoiKind[] = ['school_e', 'school_m', 'school_h', 'daycare', 'station', 'pediatric', 'mart'];
const PLACE_KINDS: readonly PlaceKind[] = ['gu', 'dong', 'station', 'school', 'daycare'];
const PRODUCTS: readonly RoomProduct[] = ['PRD_ROOM_1', 'PRD_ROOM_2', 'PRD_ROOM_3', 'PRD_ROOM_4'];
const ROOM_STATUSES: readonly RoomStatus[] = ['vacant', 'held', 'occupied'];
const BUILDING_TYPES: readonly BuildingType[] = ['house', 'apartment', 'villa', 'other'];

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T
{
    return allowed.includes(value as T) ? (value as T) : fallback;
}

function toLatLng(value: number[] | undefined, fallback: LatLng): LatLng
{
    if (!value || value.length !== 2 || !Number.isFinite(value[0]) || !Number.isFinite(value[1]))
    {
        return fallback;
    }
    return [value[0], value[1]];
}

function toCount(value: number | undefined, fallback: number): number
{
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function toDate(value: string | undefined): string
{
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '2099-12-31';
}

export function toPoiModel(dto: PoiDto): Poi
{
    return {
        kind: pick(dto.kind, POI_KINDS, 'mart'),
        nameKo: dto.name_ko ?? '',
        nameEn: dto.name_en ?? dto.name_ko ?? '',
        location: toLatLng(dto.location, SEOUL_CITY_HALL),
    };
}

export function toHouseModel(dto: HouseDto): House
{
    const dongCenter = toLatLng(dto.dong_center, SEOUL_CITY_HALL);
    return {
        id: dto.id ?? 'unknown',
        nameKo: dto.name_ko ?? '품',
        nameEn: dto.name_en ?? 'Poom',
        type: pick<HouseType>(dto.type, ['mom', 'dad'], 'mom'),
        gu: dto.gu ?? '',
        guEn: dto.gu_en ?? dto.gu ?? '',
        dong: dto.dong ?? '',
        dongEn: dto.dong_en ?? dto.dong ?? '',
        dongCenter,
        location: toLatLng(dto.location, dongCenter),
        address: dto.address ?? '',
        entryInfoKo: dto.entry_info_ko ?? '',
        entryInfoEn: dto.entry_info_en ?? dto.entry_info_ko ?? '',
        buildingType: pick(dto.building_type, BUILDING_TYPES, 'other'),
        elevator: dto.elevator ?? false,
        noStairs: dto.no_stairs ?? false,
        playroom: dto.playroom ?? false,
        parking: dto.parking ?? false,
        foreignerOk: dto.foreigner_ok ?? false,
        englishStaff: dto.english_staff ?? false,
        moveOutCleaningFee: toCount(dto.move_out_cleaning_fee, 0),
        minMonths: toCount(dto.min_months, 1),
        maxMonths: toCount(dto.max_months, DEFAULT_MAX_MONTHS),
        sharedM2: toCount(dto.shared_m2, 0),
        households: Math.max(DEFAULT_HOUSEHOLDS, toCount(dto.households, DEFAULT_HOUSEHOLDS)),
        rulesKo: dto.rules_ko ?? [],
        rulesEn: dto.rules_en ?? dto.rules_ko ?? [],
        pois: (dto.pois ?? []).map(toPoiModel),
    };
}

export function toRoomModel(dto: RoomDto, houseId: string): Room
{
    return {
        id: dto.id ?? 'unknown',
        houseId,
        product: pick(dto.product, PRODUCTS, 'PRD_ROOM_1'),
        bedrooms: Math.max(1, toCount(dto.bedrooms, 1)),
        privateM2: toCount(dto.private_m2, 0),
        privateBath: dto.private_bath ?? false,
        deposit: toCount(dto.deposit, 0),
        rent: toCount(dto.rent, 0),
        fee: toCount(dto.fee, 0),
        availableFrom: toDate(dto.available_from),
        status: pick(dto.status, ROOM_STATUSES, 'occupied'),
    };
}

export function toPlaceModel(dto: PlaceDto): Place
{
    return {
        id: dto.id ?? 'unknown',
        kind: pick(dto.kind, PLACE_KINDS, 'gu'),
        nameKo: dto.name_ko ?? '',
        nameEn: dto.name_en ?? dto.name_ko ?? '',
        gu: dto.gu ?? '',
        location: toLatLng(dto.location, SEOUL_CITY_HALL),
    };
}
