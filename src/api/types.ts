// 화면 쪽 DTO: 서버 응답 JSON 모양 (서버 Model 이 바뀌어도 화면은 이 모양만 안다)
export type HouseType = 'mom' | 'dad';
export type Gender = 'f' | 'm';
export type AgeBand = '0-5' | '6-7' | '8-12' | '13-18' | '19-24';
export const AGE_BANDS: readonly AgeBand[] = ['0-5', '6-7', '8-12', '13-18', '19-24'];

export interface ChildDraft
{
    readonly ageBand: AgeBand;
    readonly gender: Gender;
}

export interface PoiView
{
    readonly kind: string;
    readonly nameKo: string;
    readonly nameEn: string;
    readonly walkMin: number;
}

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
    readonly dongCenter: readonly [number, number];
    readonly product: string;
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
    readonly status: 'vacant' | 'held' | 'occupied';
    readonly fit: 'fits' | 'too_small' | 'household_too_large' | 'unknown';
    readonly buildingType: string;
    readonly elevator: boolean;
    readonly noStairs: boolean;
    readonly playroom: boolean;
    readonly parking: boolean;
    readonly foreignerOk: boolean;
    readonly englishStaff: boolean;
    readonly rulesKo: readonly string[];
    readonly rulesEn: readonly string[];
    readonly pois: readonly PoiView[];
    readonly placeWalkMin?: number;
}

export interface MapCluster
{
    readonly dongKo: string;
    readonly dongEn: string;
    readonly guKo: string;
    readonly center: readonly [number, number];
    readonly minMonthly: number;
    readonly vacantCount: number;
}

export interface Suggestion
{
    readonly id: string;
    readonly kind: 'gu' | 'dong' | 'station' | 'school' | 'daycare' | 'house';
    readonly nameKo: string;
    readonly nameEn: string;
    readonly guKo: string;
}

export interface UserView
{
    readonly id: string;
    readonly name: string;
    readonly phone: string;
    readonly gender: Gender;
    readonly lang: 'ko' | 'en';
    readonly idType: 'kr' | 'alien';
    readonly verified: boolean;
}

export type DocType = 'resident_reg' | 'single_parent' | 'alien_reg';

export interface ApplicationView
{
    readonly id: string;
    readonly userId: string;
    readonly roomId: string;
    readonly moveInDate: string;
    readonly months: number;
    readonly children: readonly ChildDraft[];
    readonly status: 'received' | 'approved' | 'on_hold' | 'rejected';
    readonly document?: { readonly docType: DocType; readonly checked: boolean };
    readonly createdAt: string;
    readonly consultLang: 'ko' | 'en';
    readonly situation: string;
    readonly urgency?: 'now' | 'week' | 'month';
    readonly contactTime: string;
}

export interface ContractView
{
    readonly id: string;
    readonly applicationId: string;
    readonly roomId: string;
    readonly startDate: string;
    readonly months: number;
    readonly deposit: number;
    readonly rent: number;
    readonly fee: number;
    readonly paid: boolean;
}

export interface MoveInView
{
    readonly houseNameKo: string;
    readonly houseNameEn: string;
    readonly address: string;
    readonly entryInfoKo: string;
    readonly entryInfoEn: string;
    readonly moveInDate: string;
    readonly rulesKo: readonly string[];
    readonly rulesEn: readonly string[];
}

export interface TrailEntry
{
    readonly at: number;
    readonly kind: string;
    readonly text: string;
    readonly count: number;
}

export interface ReportView
{
    readonly id: string;
    readonly kind: string;
    readonly message: string;
    readonly screenId: string;
    readonly shot?: string;
    readonly trail: readonly TrailEntry[];
    readonly env: Readonly<Record<string, string>>;
    readonly channel: string;
    readonly version: string;
    readonly lang: string;
    readonly status: 'received' | 'checking' | 'in_progress' | 'done' | 'on_hold' | 'duplicate';
    readonly severity?: string;
    readonly priority?: string;
    readonly resolution?: { readonly cause: string; readonly fix: string; readonly verify: string };
    readonly statusLog: readonly { readonly from: string; readonly to: string; readonly by: string; readonly at: string }[];
    readonly replies: readonly string[];
    readonly resolvedByReporter?: boolean;
    readonly createdAt: string;
}

export interface MetaView
{
    readonly faq: readonly { q_ko: string; a_ko: string; q_en: string; a_en: string }[];
    readonly help: readonly { number: string; name_ko: string; name_en: string; for: readonly string[] }[];
    readonly reportKinds: readonly { id: string; icon: string; name_ko: string; name_en: string }[];
}

export interface DemandView
{
    readonly id: string;
    readonly gu: string;
    readonly householdSize: number;
    readonly priceBand: string;
    readonly count: number;
}

export interface PartnerView
{
    readonly id: string;
    readonly kind: string;
    readonly gu: string;
    readonly rooms: number;
    readonly contact: string;
    readonly message: string;
    readonly createdAt: string;
}
