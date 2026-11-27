// 광고주 테스트 도우미: 공인중개사 · 집주인 만들기, 광고 하나 올리기
import type { createContainer } from '../server/container';
import type { Advertiser, Listing, ListingDraft } from '../server/models/advertising';
import type { AdvertiserKind } from '../server/models/housing';
import { signUpAsync, unwrap } from './helpers';

type Container = ReturnType<typeof createContainer>;

export const DRAFT: ListingDraft = {
    houseType: 'mom',
    placeId: 'dong-mangwon',
    titleKo: '망원동 투룸 쉐어',
    titleEn: 'Mangwon two-bedroom share',
    buildingType: 'villa',
    bedrooms: 2,
    privateM2: 26,
    sharedM2: 40,
    households: 4,
    privateBath: false,
    deposit: 500000,
    rent: 250000,
    fee: 50000,
    availableFrom: '2026-12-01',
    minMonths: 3,
    elevator: false,
    noStairs: true,
    parking: false,
    foreignerOk: true,
    descriptionKo: '초등학교 5분, 1층',
    descriptionEn: '',
};

export async function verifiedAdvertiserAsync(c: Container, kind: AdvertiserKind, phone = kind === 'agent' ? '01055556666' : '01077778888'): Promise<Advertiser>
{
    const user = await signUpAsync(c, 'f', phone);
    const registered = unwrap(await c.advertisers.registerAsync(user, {
        kind,
        nameKo: kind === 'agent' ? '한빛 공인중개사사무소' : '박집주인',
        nameEn: '',
        agentRegNo: kind === 'agent' ? '11440-2026-00001' : '',
        ownershipDoc: kind === 'owner',
    }));
    return unwrap(await c.advertisers.verifyAsync(registered.id, true));
}

// 결제 뒤 바뀐 광고주 정보(구독 기간 등) 다시 읽기
export async function refreshAsync(c: Container, advertiser: Advertiser): Promise<Advertiser>
{
    const all = unwrap(await c.advertisers.listAllAsync());
    const found = all.find((a) => a.id === advertiser.id);
    if (!found)
    {
        throw new Error('광고주 없음');
    }
    return found;
}

// 구독한 공인중개사가 광고 하나를 올려 게시 중인 상태
export async function liveAgentListingAsync(c: Container): Promise<{ advertiser: Advertiser; listing: Listing; roomId: string }>
{
    const agent = await verifiedAdvertiserAsync(c, 'agent');
    unwrap(await c.billing.buyAsync(agent, 'AD_AGENT_MONTH', '', 'card'));
    const advertiser = await refreshAsync(c, agent);
    const submitted = unwrap(await c.listings.submitAsync(advertiser, DRAFT));
    const listing = unwrap(await c.listings.approveAsync(submitted.id));
    return { advertiser, listing, roomId: listing.roomId };
}
