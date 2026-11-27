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

export interface ListingDto
{
    advertiser_id?: string;
    listed_by?: string;
    advertiser_name_ko?: string;
    advertiser_name_en?: string;
    agent_reg_no?: string;
    live_until?: string;
    top_until?: string;
    note_ko?: string;
    note_en?: string;
    example?: boolean;
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
    listing?: ListingDto;
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
