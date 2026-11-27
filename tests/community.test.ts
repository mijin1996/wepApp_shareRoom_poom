// 커뮤니티 묻고 답하기 (REQ_041 ~ 044, POL_COMMUNITY) — TC_040 ~ 046
import { describe, expect, it } from 'vitest';
import { FixedClock, MemoryNotifier, SequentialIdGenerator } from '../server/adapters/adapters';
import { createContainer } from '../server/container';
import { AppError } from '../server/core/appError';
import { HIDE_AFTER_FLAGS, QUESTIONS_PER_HOUR } from '../server/services/communityService';
import { maskPrivate } from '../server/rules/privacyMask';
import { signUpAsync, TODAY, unwrap } from './helpers';

function emptyCommunity()
{
    const clock = new FixedClock(TODAY);
    const notifier = new MemoryNotifier(true);
    const c = createContainer({ clock, notifier, ids: new SequentialIdGenerator(), communityExamples: [] });
    return { c, clock, notifier };
}

const ask = { topic: 'movein' as const, title: '서류 없이 신청 되나요?', body: '주민센터 갈 시간이 없어요', lang: 'ko' as const };

describe('질문 · 답변', () =>
{
    it('실명은 어디에도 나오지 않고 엄마/아빠 + 4글자로만 보인다', async () =>
    {
        // Given
        const { c } = emptyCommunity();
        const mom = await signUpAsync(c, 'f');

        // When
        const q = unwrap(await c.community.askAsync(mom, ask));
        const view = unwrap(await c.community.getAsync(q.id, undefined));
        const list = unwrap(await c.community.listAsync({}));

        // Then
        expect(view.alias.role).toBe('mom');
        expect(view.alias.tag).toHaveLength(4);
        expect(JSON.stringify([view, list])).not.toContain('김한별');
        expect(JSON.stringify([view, list])).not.toContain(mom.id);
    });

    it('전화번호 · 주민번호 · 이메일은 *** 로 가려서 저장한다', async () =>
    {
        const { c } = emptyCommunity();
        const mom = await signUpAsync(c);

        const q = unwrap(await c.community.askAsync(mom, { ...ask, body: '연락은 010-1234-5678, a@b.com 으로. 900101-2345678' }));

        expect(q.body).toBe('연락은 ***, *** 으로. ***');
        expect(maskPrivate('망원역 2번 출구')).toBe('망원역 2번 출구');
    });

    it('너무 짧은 제목 · 없는 주제는 InvalidInput', async () =>
    {
        const { c } = emptyCommunity();
        const mom = await signUpAsync(c);

        expect(await c.community.askAsync(mom, { ...ask, title: '질문' })).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(await c.community.askAsync(mom, { ...ask, topic: 'money' as never })).toEqual({ ok: false, error: AppError.InvalidInput });
    });

    it(`1시간에 질문 ${QUESTIONS_PER_HOUR}개까지, 넘으면 COMMUNITY_429 · 1시간 뒤 다시 가능`, async () =>
    {
        // Given
        const { c, clock } = emptyCommunity();
        const mom = await signUpAsync(c);
        for (let n = 0; n < QUESTIONS_PER_HOUR; n++)
        {
            unwrap(await c.community.askAsync(mom, { ...ask, title: `질문 번호 ${n}` }));
        }

        // When / Then
        expect(await c.community.askAsync(mom, ask)).toEqual({ ok: false, error: AppError.TooManyPosts });
        clock.advanceMinutes(61);
        expect((await c.community.askAsync(mom, ask)).ok).toBe(true);
    });

    it('질문한 사람만 해결 표시를 할 수 있다', async () =>
    {
        const { c } = emptyCommunity();
        const mom = await signUpAsync(c, 'f', '01011112222');
        const dad = await signUpAsync(c, 'm', '01033334444');
        const q = unwrap(await c.community.askAsync(mom, ask));
        const a = unwrap(await c.community.answerAsync(dad, q.id, '네, 나중에 올리면 돼요'));

        expect(await c.community.solveAsync(dad, q.id, a.id)).toEqual({ ok: false, error: AppError.Forbidden });
        unwrap(await c.community.solveAsync(mom, q.id, a.id));
        expect(unwrap(await c.community.getAsync(q.id, mom)).solvedAnswerId).toBe(a.id);
    });

    it('운영팀 공식 답변은 맨 위에 "품 운영팀"으로 보이고 목록에 표시된다', async () =>
    {
        const { c } = emptyCommunity();
        const mom = await signUpAsync(c, 'f', '01011112222');
        const dad = await signUpAsync(c, 'm', '01033334444');
        const q = unwrap(await c.community.askAsync(mom, ask));
        unwrap(await c.community.answerAsync(dad, q.id, '저도 궁금해요'));
        unwrap(await c.community.officialAnswerAsync(q.id, '입주 전까지만 내시면 돼요'));

        const view = unwrap(await c.community.getAsync(q.id, undefined));
        const summary = unwrap(await c.community.listAsync({}))[0];

        expect(view.answers[0].official).toBe(true);
        expect(view.answers[0].alias.role).toBe('team');
        expect(summary.hasOfficial).toBe(true);
        expect(summary.answerCount).toBe(2);
    });
});

describe('신고 · 숨김 (POL_COMMUNITY_05)', () =>
{
    it(`서로 다른 ${HIDE_AFTER_FLAGS}명이 신고하면 자동 숨김 + 운영 매니저 알림, 같은 사람 중복 신고는 1번`, async () =>
    {
        // Given
        const { c, notifier } = emptyCommunity();
        const writer = await signUpAsync(c, 'f', '01000000000');
        const q = unwrap(await c.community.askAsync(writer, ask));
        const users = [];
        for (let n = 1; n <= HIDE_AFTER_FLAGS; n++)
        {
            users.push(await signUpAsync(c, 'f', `0101111000${n}`));
        }

        // When: 첫 사람이 두 번 신고 → 아직 1건
        unwrap(await c.community.flagAsync(users[0], q.id, undefined));
        expect(unwrap(await c.community.flagAsync(users[0], q.id, undefined)).hidden).toBe(false);
        unwrap(await c.community.flagAsync(users[1], q.id, undefined));
        const last = unwrap(await c.community.flagAsync(users[2], q.id, undefined));

        // Then
        expect(last.hidden).toBe(true);
        expect(unwrap(await c.community.listAsync({}))).toHaveLength(0);
        expect(await c.community.getAsync(q.id, undefined)).toEqual({ ok: false, error: AppError.NotFound });
        expect(notifier.sent.some((m) => m.text.includes('자동 숨김'))).toBe(true);

        // 운영팀이 다시 보이게 하면 신고 기록도 비워진다
        unwrap(await c.community.setHiddenAsync(q.id, undefined, false));
        expect(unwrap(await c.community.listAsync({}))).toHaveLength(1);
    });

    it('운영팀 공식 답변은 신고 대상이 아니다', async () =>
    {
        const { c } = emptyCommunity();
        const mom = await signUpAsync(c);
        const q = unwrap(await c.community.askAsync(mom, ask));
        const official = unwrap(await c.community.officialAnswerAsync(q.id, '안내드려요'));

        expect(await c.community.flagAsync(mom, q.id, official.id)).toEqual({ ok: false, error: AppError.NotFound });
    });
});

describe('목록 · 예시 글', () =>
{
    it('Mock 모드는 예시 글로 시작하고, 주제 · 초성으로 거를 수 있다', async () =>
    {
        // Given: 기본 예시 글이 들어간 컨테이너
        const c = createContainer({ clock: new FixedClock(TODAY), notifier: new MemoryNotifier(true), ids: new SequentialIdGenerator() });

        // When
        const all = unwrap(await c.community.listAsync({}));
        const kids = unwrap(await c.community.listAsync({ topic: 'kids' }));
        const choseong = unwrap(await c.community.listAsync({ q: 'ㅅㄹ' }));

        // Then
        expect(all.length).toBeGreaterThan(0);
        expect(all.every((q) => q.example)).toBe(true);
        expect(kids.every((q) => q.topic === 'kids')).toBe(true);
        expect(choseong.some((q) => q.title.startsWith('서류'))).toBe(true);
    });
});
