// 공지사항 (REQ_046 ~ 048, POL_NOTICE) — TC_047 ~ 049
import { describe, expect, it } from 'vitest';
import { FixedClock, MemoryNotifier, SequentialIdGenerator } from '../server/adapters/adapters';
import { createContainer } from '../server/container';
import { AppError } from '../server/core/appError';
import { MAX_PINNED, type NoticeInput } from '../server/services/noticeService';
import { TODAY, unwrap } from './helpers';

function emptyNotices()
{
    const clock = new FixedClock(TODAY);
    const c = createContainer({ clock, notifier: new MemoryNotifier(true), ids: new SequentialIdGenerator(), noticeExamples: [] });
    return { c, clock };
}

const base: NoticeInput = { category: 'service', titleKo: '설 연휴 상담 안내', bodyKo: '연휴에는 문자로 먼저 남겨 주세요', titleEn: '', bodyEn: '', pinned: false, published: true };

describe('공지사항', () =>
{
    it('📌 고정 공지가 맨 위, 그다음 최신 순', async () =>
    {
        // Given
        const { c, clock } = emptyNotices();
        const old = unwrap(await c.notices.createAsync({ ...base, titleKo: '오래된 고정', pinned: true }));
        clock.advanceMinutes(60);
        const latest = unwrap(await c.notices.createAsync({ ...base, titleKo: '새 일반 공지' }));

        // When
        const list = unwrap(await c.notices.listAsync());

        // Then
        expect(list.map((n) => n.id)).toEqual([old.id, latest.id]);
    });

    it('내린 공지는 목록 · 보기에서 사라지고 운영 콘솔에는 남는다', async () =>
    {
        const { c } = emptyNotices();
        const n = unwrap(await c.notices.createAsync(base));

        unwrap(await c.notices.updateAsync(n.id, { ...base, published: false }));

        expect(unwrap(await c.notices.listAsync())).toHaveLength(0);
        expect(await c.notices.getAsync(n.id)).toEqual({ ok: false, error: AppError.NotFound });
        expect(unwrap(await c.notices.listAllAsync())).toHaveLength(1);
    });

    it(`고정은 최대 ${MAX_PINNED}개 — 넘으면 가장 오래된 고정이 풀린다`, async () =>
    {
        // Given
        const { c, clock } = emptyNotices();
        const ids: string[] = [];
        for (let n = 0; n <= MAX_PINNED; n++)
        {
            ids.push(unwrap(await c.notices.createAsync({ ...base, titleKo: `고정 ${n}`, pinned: true })).id);
            clock.advanceMinutes(1);
        }

        // When
        const pinned = unwrap(await c.notices.listAsync()).filter((n) => n.pinned);

        // Then
        expect(pinned).toHaveLength(MAX_PINNED);
        expect(pinned.map((n) => n.id)).not.toContain(ids[0]);
    });

    it('제목이 너무 짧거나 없는 분류는 InvalidInput, 없는 공지 고치기는 NotFound', async () =>
    {
        const { c } = emptyNotices();

        expect(await c.notices.createAsync({ ...base, titleKo: '공' })).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(await c.notices.createAsync({ ...base, category: 'ad' as never })).toEqual({ ok: false, error: AppError.InvalidInput });
        expect(await c.notices.updateAsync('n-none', base)).toEqual({ ok: false, error: AppError.NotFound });
    });

    it('Mock 모드는 예시 공지로 시작한다 (고정 1개 포함)', async () =>
    {
        const c = createContainer({ clock: new FixedClock(TODAY), notifier: new MemoryNotifier(true), ids: new SequentialIdGenerator() });

        const list = unwrap(await c.notices.listAsync());

        expect(list.length).toBeGreaterThan(0);
        expect(list[0].pinned).toBe(true);
        expect(list.every((n) => n.example)).toBe(true);
    });
});
