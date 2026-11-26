// ReportService: 의견 · 신고함 규칙 — REQ_025 ~ 027, POL_REPORT_01 ~ 10
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { Lang } from '../models/housing';
import { REPORT_KINDS, type Priority, type Report, type ReportKind, type ReportStatus, type Resolution, type Severity, type TrailEntry } from '../models/feedback';
import type { User } from '../models/people';
import type { IRecordRepository } from '../repositories/recordRepository';
import type { IClock, IIdGenerator, INotifier } from '../adapters/adapters';

export const MAX_REPORTS_PER_HOUR = 10;
export const MAX_SHOT_BYTES = 700 * 1024;
const MAX_MESSAGE = 500;
const MAX_TRAIL = 200;
const HOUR_MS = 60 * 60 * 1000;
// 사진을 찍으면 안 되는 화면 (POL_REPORT_04)
const NO_SHOT_SCREENS = ['contract', 'pay', 'movein', 'apply-3', 'document'];

export interface ReportInput
{
    readonly clientKey: string;
    readonly kind: ReportKind;
    readonly message: string;
    readonly screenId: string;
    readonly shot: string | undefined;          // data URL
    readonly trail: readonly TrailEntry[];
    readonly env: Readonly<Record<string, string>>;
    readonly channel: string;
    readonly version: string;
    readonly lang: Lang;
}

export interface ReportUpdate
{
    readonly status?: ReportStatus;
    readonly severity?: Severity;
    readonly priority?: Priority;
    readonly resolution?: Resolution;
}

function shotBytes(dataUrl: string): number
{
    const base64 = dataUrl.split(',')[1] ?? '';
    return Math.floor((base64.length * 3) / 4);
}

export class ReportService
{
    private readonly _reports: IRecordRepository<Report>;
    private readonly _notifier: INotifier;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;

    public constructor(reports: IRecordRepository<Report>, notifier: INotifier, ids: IIdGenerator, clock: IClock)
    {
        this._reports = reports;
        this._notifier = notifier;
        this._ids = ids;
        this._clock = clock;
    }

    public async submitAsync(input: ReportInput, user: User | undefined): Promise<Result<Report>>
    {
        if (!REPORT_KINDS.includes(input.kind) || input.message.trim().length === 0)
        {
            return failure(AppError.InvalidInput);
        }
        if (input.shot && shotBytes(input.shot) > MAX_SHOT_BYTES)
        {
            return failure(AppError.ShotTooLarge);
        }

        // 1시간에 10건까지 (POL_REPORT_10)
        const now = this._clock.now().getTime();
        const key = user ? 'user:' + user.id : 'client:' + input.clientKey;
        const recent = await this._reports.findWhereAsync((r) =>
            (r.userId ? 'user:' + r.userId : 'client:' + r.clientKey) === key && now - Date.parse(r.createdAt) < HOUR_MS);
        if (!recent.ok)
        {
            return recent;
        }
        if (recent.data.length >= MAX_REPORTS_PER_HOUR)
        {
            return failure(AppError.TooManyReports);
        }

        const report: Report = {
            id: this._ids.next('rp'),
            userId: user?.id,
            clientKey: input.clientKey.slice(0, 64),
            kind: input.kind,
            message: input.message.trim().slice(0, MAX_MESSAGE),
            screenId: input.screenId.slice(0, 40),
            shot: NO_SHOT_SCREENS.includes(input.screenId) ? undefined : input.shot,
            trail: input.trail.slice(-MAX_TRAIL),
            env: input.env,
            channel: input.channel,
            version: input.version,
            lang: input.lang,
            status: 'received',
            severity: undefined,
            priority: undefined,
            resolution: undefined,
            statusLog: [],
            replies: [],
            resolvedByReporter: undefined,
            createdAt: new Date(now).toISOString(),
        };
        const saved = await this._reports.saveAsync(report);
        if (saved.ok)
        {
            const urgent = report.kind === 'safety';
            await this._notifier.sendAsync({ to: urgent ? 'owner' : 'operator', urgent, text: `신고 ${report.id} [${report.kind}] ${report.message.slice(0, 40)}` });
        }
        return saved;
    }

    public async listAsync(filter: { kind?: ReportKind; status?: ReportStatus }): Promise<Result<Report[]>>
    {
        const list = await this._reports.findWhereAsync((r) => (!filter.kind || r.kind === filter.kind) && (!filter.status || r.status === filter.status));
        return list.ok ? success([...list.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) : list;
    }

    // 상태가 바뀔 때마다 시각 · 처리자 기록, 완료에는 세 줄 처리 기록 필수 (POL_REPORT_07)
    public async updateAsync(id: string, update: ReportUpdate, by: string): Promise<Result<Report>>
    {
        const current = await this._reports.getAsync(id);
        if (!current.ok)
        {
            return current;
        }
        const report = current.data;
        const resolution = update.resolution ?? report.resolution;
        if (update.status === 'done' && (!resolution || !resolution.cause.trim() || !resolution.fix.trim() || !resolution.verify.trim()))
        {
            return failure(AppError.ResolutionRequired);
        }
        const statusChanged = update.status !== undefined && update.status !== report.status;
        const next: Report = {
            ...report,
            status: update.status ?? report.status,
            severity: update.severity ?? report.severity,
            priority: update.priority ?? report.priority,
            resolution,
            statusLog: statusChanged
                ? [...report.statusLog, { from: report.status, to: update.status as ReportStatus, by, at: this._clock.now().toISOString() }]
                : report.statusLog,
        };
        const saved = await this._reports.saveAsync(next);
        if (saved.ok && statusChanged && next.status === 'done' && next.userId)
        {
            await this._notifier.sendAsync({ to: 'user:' + next.userId, urgent: false, text: '보내 주신 의견을 처리했어요' });
        }
        return saved;
    }

    public async replyAsync(id: string, message: string): Promise<Result<Report>>
    {
        const current = await this._reports.getAsync(id);
        if (!current.ok)
        {
            return current;
        }
        if (message.trim().length === 0)
        {
            return failure(AppError.InvalidInput);
        }
        return this._reports.saveAsync({ ...current.data, replies: [...current.data.replies, message.trim().slice(0, MAX_MESSAGE)] });
    }

    public async listMineAsync(user: User): Promise<Result<Report[]>>
    {
        const mine = await this._reports.findWhereAsync((r) => r.userId === user.id);
        return mine.ok ? success([...mine.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) : mine;
    }

    // 신고자 확인: 아직이면 다시 '확인'으로
    public async confirmAsync(user: User, id: string, resolved: boolean): Promise<Result<Report>>
    {
        const current = await this._reports.getAsync(id);
        if (!current.ok || current.data.userId !== user.id)
        {
            return failure(AppError.NotFound);
        }
        const report = current.data;
        if (resolved)
        {
            return this._reports.saveAsync({ ...report, resolvedByReporter: true });
        }
        return this._reports.saveAsync({
            ...report,
            resolvedByReporter: false,
            status: 'checking',
            statusLog: [...report.statusLog, { from: report.status, to: 'checking', by: 'reporter', at: this._clock.now().toISOString() }],
        });
    }
}
