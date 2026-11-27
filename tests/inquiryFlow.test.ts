// 문의 → 서류함 → 진행 표시 (품은 전달 · 기록만, 계약은 광고주와 직접) — POL_INQUIRY · POL_DOCBOX
import { describe, expect, it } from 'vitest';
import { AppError } from '../server/core/appError';
import { MOCK_FAIL_AMOUNT, MockPaymentGateway } from '../server/adapters/adapters';
import { makeContainer, signUpAsync, unwrap } from './helpers';
import { liveAgentListingAsync } from './adHelpers';

const baseInput = {
    roomId: 'r-mw-2',
    moveInDate: '2026-11-29',
    months: 3,
    children: [{ ageBand: '6-7' as const, gender: 'f' as const }],
    contactTime: '오후',
    consultLang: 'ko' as const,
    situation: '',
    urgency: undefined,
    agree: true,
};

describe('문의 보내기', () =>
{
    it('문의는 광고주에게 전달되고 진행 표시가 "보냄"으로 시작한다', async () =>
    {
        // Given
        const { c, notifier } = makeContainer();
        const user = await signUpAsync(c);

        // When
        const inquiry = unwrap(await c.inquiries.sendAsync(user, baseInput));

        // Then
        expect(inquiry.status).toBe('sent');
        expect(inquiry.advertiserId).toBe('adv-ex-agent');
        expect(inquiry.history).toHaveLength(1);
        expect(notifier.sent.some((n) => n.to === 'advertiser:adv-ex-agent')).toBe(true);
    });

    it('이름 · 연락처 · 내 상황 전달에 동의하지 않으면 보낼 수 없다', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c);

        const result = await c.inquiries.sendAsync(user, { ...baseInput, agree: false });

        expect(result).toEqual({ ok: false, error: AppError.InvalidInput });
    });

    it('여러 집에 동시에 문의할 수 있지만 같은 방은 한 번만 (APPLY_409)', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c);
        await c.inquiries.sendAsync(user, baseInput);

        const again = await c.inquiries.sendAsync(user, baseInput);
        const other = await c.inquiries.sendAsync(user, { ...baseInput, roomId: 'r-mw-1', children: [{ ageBand: '0-5', gender: 'm' }] });

        expect(again).toEqual({ ok: false, error: AppError.ApplicationInProgress });
        expect(other.ok).toBe(true);
    });

    it('가족보다 작은 방은 ROOM_422, 아빠는 엄마 가족 방에 문의할 수 없다', async () =>
    {
        const { c } = makeContainer();
        const mom = await signUpAsync(c);
        const dad = await signUpAsync(c, 'm', '01022223333');

        const small = await c.inquiries.sendAsync(mom, { ...baseInput, children: [{ ageBand: '8-12', gender: 'm' }, { ageBand: '8-12', gender: 'f' }] });
        const mismatch = await c.inquiries.sendAsync(dad, baseInput);

        expect(small).toEqual({ ok: false, error: AppError.RoomTooSmall });
        expect(mismatch).toEqual({ ok: false, error: AppError.HouseTypeMismatch });
    });

    it('나간 방은 ROOM_410', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c);

        const result = await c.inquiries.sendAsync(user, { ...baseInput, roomId: 'r-mw-4' });

        expect(result).toEqual({ ok: false, error: AppError.RoomNotVacant });
    });

    it('만 24세 이하 자녀가 없으면(빈 가족 · 25세 이상) 문의할 수 없다', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c);

        const none = await c.inquiries.sendAsync(user, { ...baseInput, children: [] });
        const over = await c.inquiries.sendAsync(user, { ...baseInput, children: [{ ageBand: '25-30' as never, gender: 'f' as const }] });
        const ok = await c.inquiries.sendAsync(user, { ...baseInput, children: [{ ageBand: '19-24' as const, gender: 'f' as const }] });

        expect(none).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(over).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(ok.ok).toBe(true);
    });

    it('내 상황은 1000자까지, 당장 필요하면 광고주에게 긴급 알림', async () =>
    {
        const { c, notifier } = makeContainer();
        const user = await signUpAsync(c);

        const inquiry = unwrap(await c.inquiries.sendAsync(user, { ...baseInput, situation: '  ' + '가'.repeat(1200), urgency: 'now' }));

        expect(inquiry.situation).toHaveLength(1000);
        expect(notifier.sent.some((m) => m.urgent && m.text.includes('당장 필요'))).toBe(true);
    });
});

describe('서류함 · 진행 표시', () =>
{
    it('서류는 한 번 올리고, 보낼 곳은 본인이 고른다. 서류가 없으면 DOC_428', async () =>
    {
        // Given
        const { c } = makeContainer();
        const user = await signUpAsync(c);
        const inquiry = unwrap(await c.inquiries.sendAsync(user, baseInput));

        // When
        const before = await c.inquiries.shareDocumentAsync(user, inquiry.id);
        unwrap(await c.inquiries.uploadDocumentAsync(user, 'single_parent'));
        const after = unwrap(await c.inquiries.shareDocumentAsync(user, inquiry.id));

        // Then
        expect(before).toEqual({ ok: false, error: AppError.DocumentRequired });
        expect(after.docShared).toBe(true);
    });

    it('광고주는 앞으로만 옮기고, 서류를 받기 전에는 "계약함"으로 못 옮긴다 (서류는 언제나 입주 전)', async () =>
    {
        // Given
        const { c } = makeContainer();
        const { advertiser, roomId } = await liveAgentListingAsync(c);
        const user = await signUpAsync(c);
        const inquiry = unwrap(await c.inquiries.sendAsync(user, { ...baseInput, roomId }));

        // When
        const viewing = unwrap(await c.inquiries.advertiserUpdateAsync(advertiser, inquiry.id, 'viewing'));
        const back = await c.inquiries.advertiserUpdateAsync(advertiser, inquiry.id, 'contacted');
        const noDoc = await c.inquiries.advertiserUpdateAsync(advertiser, inquiry.id, 'contracted');
        unwrap(await c.inquiries.uploadDocumentAsync(user, 'resident_reg'));
        unwrap(await c.inquiries.shareDocumentAsync(user, inquiry.id));
        const done = unwrap(await c.inquiries.advertiserUpdateAsync(advertiser, inquiry.id, 'contracted'));

        // Then
        expect(viewing.status).toBe('viewing');
        expect(back).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(noDoc).toEqual({ ok: false, error: AppError.DocumentRequired });
        expect(done.history.map((h) => h.status)).toEqual(['sent', 'viewing', 'contracted']);
    });

    it('광고주는 받은 문의에서 동의한 이름 · 연락처와, 보낸 경우에만 서류를 본다', async () =>
    {
        const { c } = makeContainer();
        const { advertiser, roomId } = await liveAgentListingAsync(c);
        const user = await signUpAsync(c);
        unwrap(await c.inquiries.uploadDocumentAsync(user, 'resident_reg'));
        unwrap(await c.inquiries.sendAsync(user, { ...baseInput, roomId }));

        const rows = unwrap(await c.inquiries.receivedAsync(advertiser));

        expect(rows).toHaveLength(1);
        expect(rows[0].tenantName).toBe('김한별');
        expect(rows[0].document).toBeUndefined();
    });

    it('다른 광고주의 문의는 옮길 수 없다 (COMMON_404)', async () =>
    {
        const { c } = makeContainer();
        const { advertiser } = await liveAgentListingAsync(c);
        const user = await signUpAsync(c);
        const inquiry = unwrap(await c.inquiries.sendAsync(user, baseInput));   // 예시 광고주 방

        const result = await c.inquiries.advertiserUpdateAsync(advertiser, inquiry.id, 'contacted');

        expect(result).toEqual({ ok: false, error: AppError.NotFound });
    });

    it('통계는 개인 정보 없이 숫자만 (기관 보고용)', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c);
        await c.inquiries.sendAsync(user, { ...baseInput, urgency: 'now' });

        const stats = unwrap(await c.inquiries.statsAsync());

        expect(stats.total).toBe(1);
        expect(stats.byStatus.sent).toBe(1);
        expect(stats.byGu[0]).toEqual({ gu: '마포구', count: 1 });
        expect(stats.urgentNow).toBe(1);
    });
});

describe('본인인증 · 결제사', () =>
{
    it('부모 나이는 묻지 않는다: 이름 · 휴대폰 · 엄마/아빠 · 신분만으로 인증된다', async () =>
    {
        const { c } = makeContainer();

        const result = await c.auth.verifyAsync({ name: '이하늘', phone: '01099998888', gender: 'f', idType: 'kr', lang: 'ko' });

        expect(result.ok).toBe(true);
        expect(Object.keys(unwrap(result).user)).not.toContain('birthYear');
    });

    it('전화번호 형식이 틀리면 InvalidInput', async () =>
    {
        const { c } = makeContainer();

        const result = await c.auth.verifyAsync({ name: '김한별', phone: '12', gender: 'f', idType: 'kr', lang: 'ko' });

        expect(result).toEqual({ ok: false, error: AppError.InvalidInput });
    });

    it('Mock 결제사는 정해진 실패 금액을 거절한다', async () =>
    {
        const result = await new MockPaymentGateway().chargeAsync(MOCK_FAIL_AMOUNT, 'card', 'x');

        expect(result.approved).toBe(false);
    });
});
