// 신청 → 서류 → 승인 → 계약 → 결제 → 입주 안내 (REQ_004 ~ 012, POL_HOUSE_02) — TC_003 · 004 · 005 · 019 · 023
import { describe, expect, it } from 'vitest';
import { AppError } from '../server/core/appError';
import { MOCK_FAIL_AMOUNT, MockPaymentGateway } from '../server/adapters/adapters';
import { DecliningGateway, makeContainer, signUpAsync, unwrap } from './helpers';

const baseInput = {
    roomId: 'r-mw-2',
    moveInDate: '2026-11-29',
    months: 3,
    children: [{ ageBand: '6-7' as const, gender: 'f' as const }],
    contactTime: '오후',
    consultLang: 'ko' as const,
    memo: '',
    docType: undefined,
};

describe('신청', () =>
{
    it('서류 없이도 신청은 접수되고 운영 매니저에게 알림이 간다', async () =>
    {
        // Given
        const { c, notifier } = makeContainer();
        const user = await signUpAsync(c);

        // When
        const result = await c.applications.applyAsync(user, baseInput);

        // Then
        const app = unwrap(result);
        expect(app.status).toBe('received');
        expect(app.document).toBeUndefined();
        expect(notifier.sent.some((n) => n.to === 'operator')).toBe(true);
    });

    it('진행 중인 신청이 있으면 두 번째 신청은 APPLY_409', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c);
        await c.applications.applyAsync(user, baseInput);

        const second = await c.applications.applyAsync(user, { ...baseInput, roomId: 'r-mw-1', children: [{ ageBand: '0-5', gender: 'm' }] });

        expect(second).toEqual({ ok: false, error: AppError.ApplicationInProgress });
    });

    it('가족보다 작은 방은 ROOM_422 (9살 아들 + 10살 딸에게 침실 2)', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c);

        const result = await c.applications.applyAsync(user, { ...baseInput, children: [{ ageBand: '8-12', gender: 'm' }, { ageBand: '8-12', gender: 'f' }] });

        expect(result).toEqual({ ok: false, error: AppError.RoomTooSmall });
    });

    it('아빠는 엄마 하우스에 신청할 수 없다', async () =>
    {
        const { c } = makeContainer();
        const dad = await signUpAsync(c, 'm');

        const result = await c.applications.applyAsync(dad, baseInput);

        expect(result).toEqual({ ok: false, error: AppError.HouseTypeMismatch });
    });

    it('입주 중인 방은 ROOM_410', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c);

        const result = await c.applications.applyAsync(user, { ...baseInput, roomId: 'r-mw-4' });

        expect(result).toEqual({ ok: false, error: AppError.RoomNotVacant });
    });
});

describe('서류 확인 전에는 계약할 수 없다 (DOC_428)', () =>
{
    it('승인됐어도 서류가 없으면 DOC_428, 확인되면 서명 → 결제 → 주소 공개', async () =>
    {
        // Given: 승인된 신청, 서류 없음
        const { c } = makeContainer();
        const user = await signUpAsync(c);
        const app = unwrap(await c.applications.applyAsync(user, baseInput));
        unwrap(await c.applications.decideAsync(app.id, 'approve'));

        // When: 서명 시도 / Then: 서류 필요
        expect(await c.contracts.signAsync(user, app.id, '김한별')).toEqual({ ok: false, error: AppError.DocumentRequired });

        // 서류 올림 → 확인 전엔 여전히 막힘
        unwrap(await c.applications.uploadDocumentAsync(user, app.id, 'resident_reg'));
        expect(await c.contracts.signAsync(user, app.id, '김한별')).toEqual({ ok: false, error: AppError.DocumentRequired });

        // 결제 전에는 주소를 볼 수 없다
        expect(await c.contracts.moveInAsync(user)).toEqual({ ok: false, error: AppError.NotPaid });

        // 운영 매니저 확인 → 서명 → 결제
        unwrap(await c.applications.confirmDocumentAsync(app.id));
        const contract = unwrap(await c.contracts.signAsync(user, app.id, '김한별'));
        const payment = unwrap(await c.contracts.payAsync(user, contract.id, 'card'));

        // Then
        expect(payment.amount).toBe(600000 + 280000 + 60000);
        const moveIn = unwrap(await c.contracts.moveInAsync(user));
        expect(moveIn.address).toContain('망원동');
        const room = unwrap(await c.rooms.getRoomAsync('r-mw-2', []));
        expect(room.status).toBe('occupied');
    });

    it('승인 전 서명은 CONTRACT_403', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c);
        const app = unwrap(await c.applications.applyAsync(user, { ...baseInput, docType: 'single_parent' }));

        expect(await c.contracts.signAsync(user, app.id, '김한별')).toEqual({ ok: false, error: AppError.NotApproved });
    });
});

describe('결제 실패', () =>
{
    it('결제사가 거절하면 PAY_402, 방은 잡아 둔 상태 그대로', async () =>
    {
        // Given: 항상 거절하는 결제사
        const { c } = makeContainer(new DecliningGateway());
        const user = await signUpAsync(c);
        const app = unwrap(await c.applications.applyAsync(user, { ...baseInput, docType: 'resident_reg' }));
        unwrap(await c.applications.decideAsync(app.id, 'approve'));
        unwrap(await c.applications.confirmDocumentAsync(app.id));
        const contract = unwrap(await c.contracts.signAsync(user, app.id, '김한별'));

        // When
        const paid = await c.contracts.payAsync(user, contract.id, 'card');

        // Then
        expect(paid).toEqual({ ok: false, error: AppError.PaymentFailed });
        expect(unwrap(await c.rooms.getRoomAsync('r-mw-2', [])).status).toBe('held');
    });

    it('Mock 결제사는 정해진 실패 금액을 거절한다', async () =>
    {
        const result = await new MockPaymentGateway().chargeAsync(MOCK_FAIL_AMOUNT, 'card', 'x');

        expect(result.approved).toBe(false);
    });
});

describe('본인인증', () =>
{
    it('부모 나이 제한은 없다: 만 19세 미만 부모도 인증되고 법정대리인 동의 대상으로 표시된다', async () =>
    {
        // Given
        const { c } = makeContainer();

        // When
        const young = unwrap(await c.auth.verifyAsync({ name: '이하늘', phone: '01099998888', birthYear: 2009, gender: 'f', idType: 'kr', lang: 'ko' }));
        const older = unwrap(await c.auth.verifyAsync({ name: '박보람', phone: '01077776666', birthYear: 1965, gender: 'm', idType: 'kr', lang: 'ko' }));

        // Then
        expect(young.user.minorParent).toBe(true);
        expect(older.user.minorParent).toBe(false);
    });

    it('만 19세 미만 부모도 방을 신청할 수 있다', async () =>
    {
        // Given
        const { c } = makeContainer();
        const { user } = unwrap(await c.auth.verifyAsync({ name: '이하늘', phone: '01099998888', birthYear: 2009, gender: 'f', idType: 'kr', lang: 'ko' }));

        // When
        const result = await c.applications.applyAsync(user, baseInput);

        // Then
        expect(result.ok).toBe(true);
    });

    it('있을 수 없는 태어난 해는 InvalidInput', async () =>
    {
        const { c } = makeContainer();

        const future = await c.auth.verifyAsync({ name: '김한별', phone: '01055554444', birthYear: 2099, gender: 'f', idType: 'kr', lang: 'ko' });
        const ancient = await c.auth.verifyAsync({ name: '김한별', phone: '01055554444', birthYear: 1800, gender: 'f', idType: 'kr', lang: 'ko' });

        expect(future).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(ancient).toEqual({ ok: false, error: AppError.InvalidInput });
    });

    it('전화번호 형식이 틀리면 InvalidInput', async () =>
    {
        const { c } = makeContainer();

        const result = await c.auth.verifyAsync({ name: '김한별', phone: '12', birthYear: 1990, gender: 'f', idType: 'kr', lang: 'ko' });

        expect(result).toEqual({ ok: false, error: AppError.InvalidInput });
    });
});
