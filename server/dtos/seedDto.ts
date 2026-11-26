// DTO: JSON 모양 그대로 (snake_case), 전부 없을 수 있음(?) (개념편 5.2)
export interface PoiDto
{
    kind?: string;
    name_ko?: string;
    name_en?: string;
    location?: number[];
}

export interface RoomDto
{
    id?: string;
    product?: string;
    bedrooms?: number;
    private_m2?: number;
    private_bath?: boolean;
    deposit?: number;
    rent?: number;
    fee?: number;
    available_from?: string;
    status?: string;
}

export interface HouseDto
{
    id?: string;
    name_ko?: string;
    name_en?: string;
    type?: string;
    gu?: string;
    gu_en?: string;
    dong?: string;
    dong_en?: string;
    dong_center?: number[];
    location?: number[];
    address?: string;
    entry_info_ko?: string;
    entry_info_en?: string;
    building_type?: string;
    elevator?: boolean;
    no_stairs?: boolean;
    playroom?: boolean;
    parking?: boolean;
    foreigner_ok?: boolean;
    english_staff?: boolean;
    move_out_cleaning_fee?: number;
    min_months?: number;
    max_months?: number;
    shared_m2?: number;
    households?: number;
    rules_ko?: string[];
    rules_en?: string[];
    pois?: PoiDto[];
    rooms?: RoomDto[];
}

export interface PlaceDto
{
    id?: string;
    kind?: string;
    name_ko?: string;
    name_en?: string;
    gu?: string;
    location?: number[];
}
