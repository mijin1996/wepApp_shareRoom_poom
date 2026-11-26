// Model: 순수 데이터, null 없음, 바꾸지 않음(readonly) (개념편 5.2)
export type Lang = 'ko' | 'en';
export type LatLng = readonly [number, number];
export type HouseType = 'mom' | 'dad';
export type RoomStatus = 'vacant' | 'held' | 'occupied';
export type RoomProduct = 'PRD_ROOM_1' | 'PRD_ROOM_2' | 'PRD_ROOM_3' | 'PRD_ROOM_4';
export type PoiKind = 'school_e' | 'school_m' | 'school_h' | 'daycare' | 'station' | 'pediatric' | 'mart';
export type BuildingType = 'house' | 'apartment' | 'villa' | 'other';
export type PlaceKind = 'gu' | 'dong' | 'station' | 'school' | 'daycare';

export interface Poi
{
    readonly kind: PoiKind;
    readonly nameKo: string;
    readonly nameEn: string;
    readonly location: LatLng;
}

export interface House
{
    readonly id: string;
    readonly nameKo: string;
    readonly nameEn: string;
    readonly type: HouseType;
    readonly gu: string;
    readonly guEn: string;
    readonly dong: string;
    readonly dongEn: string;
    readonly dongCenter: LatLng;
    readonly location: LatLng;        // 비공개: 서버 계산에만 씀
    readonly address: string;         // 비공개: 결제 후에만
    readonly entryInfoKo: string;     // 비공개: 결제 후에만
    readonly entryInfoEn: string;
    readonly buildingType: BuildingType;
    readonly elevator: boolean;
    readonly noStairs: boolean;
    readonly playroom: boolean;
    readonly parking: boolean;
    readonly foreignerOk: boolean;
    readonly englishStaff: boolean;
    readonly moveOutCleaningFee: number;
    readonly minMonths: number;
    readonly maxMonths: number;
    readonly sharedM2: number;
    readonly households: number;
    readonly rulesKo: readonly string[];
    readonly rulesEn: readonly string[];
    readonly pois: readonly Poi[];
}

export interface Room
{
    readonly id: string;
    readonly houseId: string;
    readonly product: RoomProduct;
    readonly bedrooms: number;
    readonly privateM2: number;
    readonly privateBath: boolean;
    readonly deposit: number;
    readonly rent: number;
    readonly fee: number;
    readonly availableFrom: string;   // YYYY-MM-DD
    readonly status: RoomStatus;
}

export interface Place
{
    readonly id: string;
    readonly kind: PlaceKind;
    readonly nameKo: string;
    readonly nameEn: string;
    readonly gu: string;
    readonly location: LatLng;
}
