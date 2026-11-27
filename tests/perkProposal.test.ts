// 혜택(제휴 · 후원 · 기관) · 문의 메뉴(제안) — POL_PERK · POL_PROPOSAL
import { describe, expect, it } from 'vitest';
import { FixedClock, MemoryNotifier, SequentialIdGenerator } from '../server/adapters/adapters';
import { createContainer } from '../server/container';
import { AppError } from '../server/core/appError';
import { makeContainer, signUpAsync, TODAY, unwrap } from './helpers';

const LINK_PERK = {
    kind: 'partner' as const,
    action: 'link' as const,
    url: 'https://example.com/moving',
    providerKo: '한빛 이사',
    providerEn: '',
    titleKo: '이사 10% 할인',
    titleEn: '',
    descKo: '품 회원 할인',
    descEn: '',
    active: true,
};

function emptyPerks()
{
    return createContainer({ clock: new FixedClock(TODAY), notifier: new MemoryNotifier(true), ids: new SequentialIdGenerator(), perkExamples: [] });
}

describe('혜택', () =>
{
    it('예시 혜택 4개가 보이고, 종류로 거를 수 있다', async () =>
    {
        const { c } = makeContainer();

        const all = unwrap(await c.perks.listAsync(undefined));
        const sponsor = unwrap(await c.perks.listAsync('sponsor'));

        expect(all).toHaveLength(4);
        expect(sponsor.every((p) => p.kind === 'sponsor')).toBe(true);
    });

    it('제휴 업체로 이동하면 이용 수만 센다 (누가 눌렀는지는 남기지 않음)', async () =>
    {
        const c = emptyPerks();
        const perk = unwrap(await c.perks.createAsync(LINK_PERK));

        const url = unwrap(await c.perks.openAsync(perk.id));
        const rows = unwrap(await c.perks.listAllAsync());

        expect(url).toBe('https://example.com/moving');
        expect(rows[0].perk.clicks).toBe(1);
    });

    it('후원 · 기관 지원은 신청을 남기고, 같은 혜택은 한 번만 (COMMON_409)', async () =>
    {
        const { c, notifier } = makeContainer();
        const user = await signUpAsync(c);

        const first = await c.perks.requestAsync(user, 'perk-ex-3', '아이 둘, 다음 달 입주');
        const again = await c.perks.requestAsync(user, 'perk-ex-3', '');

        expect(first.ok).toBe(true);
        expect(again).toEqual({ ok: false, error: AppError.AlreadyDone });
        expect(unwrap(await c.perks.myRequestsAsync(user))).toEqual(['perk-ex-3']);
        expect(notifier.sent.some((n) => n.to === 'operator' && n.text.includes('혜택 신청'))).toBe(true);
    });

    it('링크 혜택은 https 주소가 있어야 하고, 내린 혜택은 안 보인다', async () =>
    {
        const c = emptyPerks();

        const noUrl = await c.perks.createAsync({ ...LINK_PERK, url: 'http://example.com' });
        const perk = unwrap(await c.perks.createAsync(LINK_PERK));
        unwrap(await c.perks.updateAsync(perk.id, { ...LINK_PERK, active: false }));

        expect(noUrl).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(unwrap(await c.perks.listAsync(undefined))).toHaveLength(0);
        expect(await c.perks.openAsync(perk.id)).toEqual({ ok: false, error: AppError.NotFound });
    });
});

describe('문의 메뉴 (광고 · 제휴 · 후원 · 기관 제안)', () =>
{
    it('로그인 없이 제안을 남기면 운영 매니저에게 알림, 본문의 주민번호는 가린다', async () =>
    {
        const { c, notifier } = makeContainer();

        const proposal = unwrap(await c.proposals.submitAsync({ kind: 'sponsor', org: '예시 기업', name: '담당자', contact: 'csr@example.com', message: '방 10개 후원 원해요 900101-1234567' }));

        expect(proposal.status).toBe('new');
        expect(proposal.message).not.toContain('1234567');
        expect(notifier.sent.some((n) => n.to === 'operator' && n.text.includes('sponsor'))).toBe(true);
    });

    it('종류 · 연락처 · 내용이 없으면 InvalidInput, 처리 상태는 정해진 값만', async () =>
    {
        const { c } = makeContainer();

        const bad = await c.proposals.submitAsync({ kind: 'spam' as never, org: '', name: '', contact: '01012345678', message: '안녕하세요 제안' });
        const short = await c.proposals.submitAsync({ kind: 'partner', org: '', name: '', contact: '010', message: '안녕하세요 제안' });
        const ok = unwrap(await c.proposals.submitAsync({ kind: 'institution', org: '예시 구청', name: '', contact: '02-000-0000', message: '한부모 주거 연계 협의' }));
        const done = unwrap(await c.proposals.setStatusAsync(ok.id, 'done'));
        const wrong = await c.proposals.setStatusAsync(ok.id, 'lost' as never);

        expect(bad).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(short).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(done.status).toBe('done');
        expect(wrong).toEqual({ ok: false, error: AppError.InvalidInput });
    });
});
