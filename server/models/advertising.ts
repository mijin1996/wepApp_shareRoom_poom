// 광고 Model: 광고주 · 광고 신청 · 광고 상품 · 청구 (POL_AD)
// 품은 광고판 — 계약 · 방값은 광고주와 입주자가 직접. 품이 받는 돈은 계약 성사와 무관한 고정 금액뿐
import type { AdvertiserKind, BuildingType, HouseType } from './housing';

export type VerifyStatus = 'pending' | 'verified' | 'rejected';

export interface Advertiser
{
    readonly id: string;
    readonly userId: string;
    readonly kind: AdvertiserKind;
    readonly nameKo: string;               // 중개사무소 이름 / 집주인 표시 이름
    readonly nameEn: string;
    readonly agentRegNo: string;           // 공인중개사 등록번호 (집주인은 '')
    readonly ownershipDoc: boolean;        // 집주인: 등기부등본 등 소유 확인 서류를 올렸는지
    readonly status: VerifyStatus;         // 운영 매니저 확인 전에는 광고를 올릴 수 없음
    readonly subscriptionUntil: string;    // 공인중개사 구독 끝나는 날 YYYY-MM-DD, '' = 없음
    readonly createdAt: string;
}

// review(확인 중) → approved(결제 · 구독 기다림) → live(게시 중) → ended(내림) / rejected(반려)
export type ListingStatus = 'review' | 'approved' | 'live' | 'rejected' | 'ended';

// 광고주가 쓰는 광고 내용 (승인되면 방 찾기에 House · Room 으로 올라감)
export interface ListingDraft
{
    readonly houseType: HouseType;
    readonly placeId: string;              // 동 (places.json 의 dong)
    readonly titleKo: string;
    readonly titleEn: string;
    readonly buildingType: BuildingType;
    readonly bedrooms: number;
    readonly privateM2: number;
    readonly sharedM2: number;
    readonly households: number;
    readonly privateBath: boolean;
    readonly deposit: number;
    readonly rent: number;
    readonly fee: number;
    readonly availableFrom: string;
    readonly minMonths: number;
    readonly elevator: boolean;
    readonly noStairs: boolean;
    readonly parking: boolean;
    readonly foreignerOk: boolean;
    readonly descriptionKo: string;
    readonly descriptionEn: string;
}

export interface Listing
{
    readonly id: string;
    readonly advertiserId: string;
    readonly draft: ListingDraft;
    readonly status: ListingStatus;
    readonly houseId: string;              // 올라간 뒤의 House id ('' = 아직)
    readonly roomId: string;
    readonly liveUntil: string;
    readonly topUntil: string;
    readonly rejectReason: string;
    readonly createdAt: string;
}

export type ProductId = 'AD_OWNER_30D' | 'AD_AGENT_MONTH' | 'AD_TOP_7D' | 'AD_LEAD';
export const PRODUCT_IDS: readonly ProductId[] = ['AD_OWNER_30D', 'AD_AGENT_MONTH', 'AD_TOP_7D', 'AD_LEAD'];
export type ProductFor = AdvertiserKind | 'both';

export interface AdProduct
{
    readonly id: ProductId;
    readonly forKind: ProductFor;
    readonly price: number;                // 원, 부가세 별도
    readonly days: number;                 // 0 = 기간 없음 (문의당 과금)
    readonly nameKo: string;
    readonly nameEn: string;
    readonly descKo: string;
    readonly descEn: string;
}

// 청구: 바로 결제(paid) 또는 월말 정산(문의당 과금)
export interface Charge
{
    readonly id: string;
    readonly advertiserId: string;
    readonly productId: ProductId;
    readonly amount: number;
    readonly listingId: string;
    readonly inquiryId: string;
    readonly paid: boolean;
    readonly createdAt: string;
}
