// 의견 · 신고함 (POL_REPORT) — TC_026 ~ 030
import { describe, expect, it } from 'vitest';
import { AppError } from '../server/core/appError';
import { MAX_REPORTS_PER_HOUR, type ReportInput } from '../server/services/reportService';
import { makeContainer, signUpAsync, unwrap } from './helpers';

const input: ReportInput = {
    clientKey: 'device-1',
    kind: 'bug',
    message: '신청 2단계에서 멈춰요',
    screenId: 'apply-2',
    shot: 'data:image/jpeg;base64,AAAA',
    trail: [{ at: 1, kind: 'click', text: '다음', count: 1 }],
    env: { width: '390', height: '844' },
    channel: 'test',
    version: '0.1.0',
    lang: 'ko',
};

describe('신고 보내기', () =>
{
    it('사진 · 3분 기록 · 판 정보가 함께 접수된다', async () =>
    {
        // Given
        const { c } = makeContainer();

        // When
        const report = unwrap(await c.reports.submitAsync(input, undefined));

        // Then
        expect(report.status).toBe('received');
        expect(report.shot).toBeDefined();
        expect(report.trail).toHaveLength(1);
        expect(report.channel).toBe('test');
    });

    it('계약 · 결제 · 입주 안내 화면에서는 사진을 저장하지 않는다 (POL_REPORT_04)', async () =>
    {
        const { c } = makeContainer();

        const report = unwrap(await c.reports.submitAsync({ ...input, screenId: 'movein' }, undefined));

        expect(report.shot).toBeUndefined();
    });

    it('🛡 안전 신고는 대표에게 긴급 알림 (POL_REPORT_02)', async () =>
    {
        const { c, notifier } = makeContainer();

        unwrap(await c.reports.submitAsync({ ...input, kind: 'safety', message: '모르는 사람이 찾아왔어요' }, undefined));

        expect(notifier.sent.some((n) => n.urgent && n.to === 'owner')).toBe(true);
    });

    it('경계: 1시간에 10건까지, 11번째는 REPORT_429 · 1시간 지나면 다시 된다', async () =>
    {
        const { c, clock } = makeContainer();
        for (let i = 0; i < MAX_REPORTS_PER_HOUR; i++)
        {
            unwrap(await c.reports.submitAsync(input, undefined));
        }

        expect(await c.reports.submitAsync(input, undefined)).toEqual({ ok: false, error: AppError.TooManyReports });

        clock.advanceMinutes(61);
        expect((await c.reports.submitAsync(input, undefined)).ok).toBe(true);
    });

    it('700KB 넘는 사진은 REPORT_413', async () =>
    {
        const { c } = makeContainer();
        const big = 'data:image/jpeg;base64,' + 'A'.repeat(1_000_000);

        expect(await c.reports.submitAsync({ ...input, shot: big }, undefined)).toEqual({ ok: false, error: AppError.ShotTooLarge });
    });
});

describe('신고함 처리', () =>
{
    it('완료에는 원인 / 고친 것 / 확인 방법이 필요하고, 상태 기록이 남는다 (POL_REPORT_07)', async () =>
    {
        // Given
        const { c, notifier } = makeContainer();
        const user = await signUpAsync(c);
        const report = unwrap(await c.reports.submitAsync(input, user));

        // When: 세 줄 없이 완료
        const noResolution = await c.reports.updateAsync(report.id, { status: 'done' }, 'QA');

        // Then
        expect(noResolution).toEqual({ ok: false, error: AppError.ResolutionRequired });

        // When: 확인 → 완료 (세 줄)
        unwrap(await c.reports.updateAsync(report.id, { status: 'checking', severity: 'high', priority: 'P1' }, 'QA'));
        const done = unwrap(await c.reports.updateAsync(report.id, { status: 'done', resolution: { cause: '날짜 빈값', fix: '기본값', verify: 'TC_003' } }, '개발자'));

        // Then
        expect(done.statusLog.map((l) => l.to)).toEqual(['checking', 'done']);
        expect(notifier.sent.some((n) => n.to === 'user:' + user.id)).toBe(true);
    });

    it('신고자가 "아직이에요"를 누르면 다시 확인 상태', async () =>
    {
        const { c } = makeContainer();
        const user = await signUpAsync(c);
        const report = unwrap(await c.reports.submitAsync(input, user));
        unwrap(await c.reports.updateAsync(report.id, { status: 'done', resolution: { cause: 'a', fix: 'b', verify: 'c' } }, 'QA'));

        const again = unwrap(await c.reports.confirmAsync(user, report.id, false));

        expect(again.status).toBe('checking');
    });
});
