// 광고 플랫폼: 광고주 확인 · 광고 게시 · 구독 · 상단 노출 · 문의 과금 — POL_AD
import { describe, expect, it } from 'vitest';
import { AppError } from '../server/core/appError';
import { DecliningGateway, makeContainer, signUpAsync, unwrap } from './helpers';
import { DRAFT, liveAgentListingAsync, refreshAsync, verifiedAdvertiserAsync } from './adHelpers';

describe('광고주 등록 · 확인', () =>
{
    it('공인중개사는 등록번호, 집주인은 소유 확인 서류가 있어야 등록된다', async () =>
    {
        // Given
        const { c } = makeContainer();
        const agentUser = await signUpAsync(c, 'f', '01011112222');
        const ownerUser = await signUpAsync(c, 'm', '01033334444');

        // When
        const noRegNo = await c.advertisers.registerAsync(agentUser, { kind: 'agent', nameKo: '한빛 공인중개사', nameEn: '', agentRegNo: '', ownershipDoc: false });
        const noDoc = await c.advertisers.registerAsync(ownerUser, { kind: 'owner', nameKo: '박집주인', nameEn: '', agentRegNo: '', ownershipDoc: false });
        const ok = unwrap(await c.advertisers.registerAsync(ownerUser, { kind: 'owner', nameKo: '박집주인', nameEn: '', agentRegNo: '123', ownershipDoc: true }));

        // Then
        expect(noRegNo).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(noDoc).toEqual({ ok: false, error: AppError.DocumentRequired });
        expect(ok.status).toBe('pending');
        expect(ok.agentRegNo).toBe('');     // 집주인은 등록번호를 남기지 않음
    });

    it('운영 매니저 확인 전에는 광고를 올릴 수 없다 (AD_403)', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c, 'f', '01011112222');
        const pending = unwrap(await c.advertisers.registerAsync(user, { kind: 'agent', nameKo: '한빛 공인중개사', nameEn: '', agentRegNo: '11440-2026-00001', ownershipDoc: false }));

        const result = await c.listings.submitAsync(pending, DRAFT);
        const verified = await c.advertisers.verifiedOfAsync(user);

        expect(result).toEqual({ ok: false, error: AppError.AdvertiserNotVerified });
        expect(verified).toEqual({ ok: false, error: AppError.AdvertiserNotVerified });
    });

    it('한 사람은 광고주 등록을 한 번만 한다 (COMMON_409)', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c, 'f', '01011112222');
        const input = { kind: 'owner' as const, nameKo: '박집주인', nameEn: '', agentRegNo: '', ownershipDoc: true };
        await c.advertisers.registerAsync(user, input);

        const again = await c.advertisers.registerAsync(user, input);

        expect(again).toEqual({ ok: false, error: AppError.AlreadyDone });
    });
});

describe('광고 게시 (품은 광고판)', () =>
{
    it('집주인: 확인 → 광고비 9,900원 결제 → 30일 게시 → 방 찾기에 "집주인 직거래"로 보인다', async () =>
    {
        // Given
        const { c } = makeContainer();
        const owner = await verifiedAdvertiserAsync(c, 'owner');
        const submitted = unwrap(await c.listings.submitAsync(owner, DRAFT));

        // When
        const approved = unwrap(await c.listings.approveAsync(submitted.id));
        const charge = unwrap(await c.billing.buyAsync(owner, 'AD_OWNER_30D', submitted.id, 'card'));
        const live = unwrap(await c.listings.getOwnAsync(owner, submitted.id));
        const view = unwrap(await c.rooms.getRoomAsync(live.roomId, []));

        // Then
        expect(approved.status).toBe('approved');   // 결제 전에는 안 보임
        expect(charge.amount).toBe(9900);
        expect(live.status).toBe('live');
        expect(live.liveUntil).toBe('2026-12-27');
        expect(view.listedBy).toBe('owner');
        expect(view.advertiserNameKo).toBe('박집주인');
        expect(view.dongKo).toBe('망원동');
    });

    it('공인중개사: 구독 중이면 확인 즉시 게시되고, 구독을 늘리면 광고 기간도 같이 늘어난다', async () =>
    {
        const { c } = makeContainer();
        const { advertiser, listing } = await liveAgentListingAsync(c);

        unwrap(await c.billing.buyAsync(advertiser, 'AD_AGENT_MONTH', '', 'card'));
        const after = unwrap(await c.listings.getOwnAsync(advertiser, listing.id));

        expect(listing.status).toBe('live');
        expect(listing.liveUntil).toBe('2026-12-27');
        expect(after.liveUntil).toBe('2027-01-26');
        expect((await refreshAsync(c, advertiser)).subscriptionUntil).toBe('2027-01-26');
    });

    it('집주인은 공인중개사 구독을 살 수 없고, 문의 과금은 사는 상품이 아니다', async () =>
    {
        const { c } = makeContainer();
        const owner = await verifiedAdvertiserAsync(c, 'owner');

        const plan = await c.billing.buyAsync(owner, 'AD_AGENT_MONTH', '', 'card');
        const lead = await c.billing.buyAsync(owner, 'AD_LEAD', '', 'card');

        expect(plan).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(lead).toEqual({ ok: false, error: AppError.InvalidInput });
    });

    it('광고 기간이 끝나면 방 찾기 · 상세 · 검색 추천에서 사라진다', async () =>
    {
        const { c, clock } = makeContainer();
        const { roomId } = await liveAgentListingAsync(c);

        clock.advanceMinutes(31 * 24 * 60);   // 2026-12-28
        const detail = await c.rooms.getRoomAsync(roomId, []);
        const search = unwrap(await c.rooms.searchAsync({ children: [] }));

        expect(detail).toEqual({ ok: false, error: AppError.NotFound });
        expect(search.some((v) => v.roomId === roomId)).toBe(false);
        expect(unwrap(await c.search.suggestAsync('망원동 투룸')).some((s) => s.kind === 'house')).toBe(false);
    });

    it('반려는 이유가 있어야 하고, 내린 광고는 바로 안 보인다', async () =>
    {
        const { c } = makeContainer();
        const { advertiser, listing, roomId } = await liveAgentListingAsync(c);
        const second = unwrap(await c.listings.submitAsync(advertiser, { ...DRAFT, titleKo: '두 번째 방' }));

        const noReason = await c.listings.rejectAsync(second.id, '');
        const rejected = unwrap(await c.listings.rejectAsync(second.id, '사진과 다름'));
        unwrap(await c.listings.endMineAsync(advertiser, listing.id));

        expect(noReason).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(rejected.status).toBe('rejected');
        expect(await c.rooms.getRoomAsync(roomId, [])).toEqual({ ok: false, error: AppError.NotFound });
    });

    it('광고 내용이 이상하면(방 0개 · 모르는 동네) 올릴 수 없다', async () =>
    {
        const { c } = makeContainer();
        const owner = await verifiedAdvertiserAsync(c, 'owner');

        const zero = await c.listings.submitAsync(owner, { ...DRAFT, bedrooms: 0 });
        const place = await c.listings.submitAsync(owner, { ...DRAFT, placeId: 'station-x' });

        expect(zero).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(place).toEqual({ ok: false, error: AppError.InvalidInput });
    });
});

describe('상단 노출 · 결제 실패', () =>
{
    it('상단 노출 7일을 사면 방 찾기 맨 위에 "추천"으로 보인다', async () =>
    {
        const { c } = makeContainer();
        const { advertiser, listing, roomId } = await liveAgentListingAsync(c);

        unwrap(await c.billing.buyAsync(advertiser, 'AD_TOP_7D', listing.id, 'card'));
        const views = unwrap(await c.rooms.searchAsync({ children: [], sort: 'cheap' }));

        expect(views[0].roomId).toBe(roomId);
        expect(views[0].featured).toBe(true);
    });

    it('결제사가 거절하면 PAY_402 이고 기간은 그대로', async () =>
    {
        const { c } = makeContainer(new DecliningGateway());
        const agent = await verifiedAdvertiserAsync(c, 'agent');

        const result = await c.billing.buyAsync(agent, 'AD_AGENT_MONTH', '', 'card');

        expect(result).toEqual({ ok: false, error: AppError.PaymentFailed });
        expect((await refreshAsync(c, agent)).subscriptionUntil).toBe('');
    });
});

describe('문의당 과금 (계약 성사와 무관)', () =>
{
    it('공인중개사 광고에 문의가 오면 1,000원이 쌓이고, 월말에 한 번에 정산한다', async () =>
    {
        // Given
        const { c } = makeContainer();
        const { advertiser, roomId } = await liveAgentListingAsync(c);
        const mom = await signUpAsync(c);
        const input = { roomId, moveInDate: '2026-12-01', months: 3, children: [{ ageBand: '6-7' as const, gender: 'f' as const }], contactTime: '', consultLang: 'ko' as const, situation: '', urgency: undefined, agree: true };

        // When
        unwrap(await c.inquiries.sendAsync(mom, input));
        const before = unwrap(await c.billing.statementAsync(advertiser));
        const settled = unwrap(await c.billing.settleAsync(advertiser, 'card'));
        const after = unwrap(await c.billing.statementAsync(advertiser));
        const again = await c.billing.settleAsync(advertiser, 'card');

        // Then
        expect(before.unpaidTotal).toBe(1000);
        expect(settled).toBe(1000);
        expect(after.unpaidTotal).toBe(0);
        expect(again).toEqual({ ok: false, error: AppError.AlreadyDone });
    });

    it('집주인 광고 · 예시 광고에는 문의 과금이 없다', async () =>
    {
        const { c } = makeContainer();
        const mom = await signUpAsync(c);

        unwrap(await c.inquiries.sendAsync(mom, { roomId: 'r-mw-2', moveInDate: '2026-11-29', months: 3, children: [{ ageBand: '6-7', gender: 'f' }], contactTime: '', consultLang: 'ko', situation: '', urgency: undefined, agree: true }));
        const revenue = unwrap(await c.billing.revenueAsync());

        expect(revenue.find((r) => r.productId === 'AD_LEAD')?.count).toBe(0);
    });
});
