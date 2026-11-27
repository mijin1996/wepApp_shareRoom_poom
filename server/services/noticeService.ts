// NoticeService: 공지사항 — REQ_046 ~ 048, POL_NOTICE_01 ~ 04
// 보기는 누구나, 쓰기 · 고치기 · 내리기는 운영 콘솔에서만. 지우지 않고 "내림"으로 기록을 남긴다.
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { ExampleNoticeDto } from '../dtos/noticeDto';
import { toExampleNotice } from '../mappers/noticeMapper';
import { NOTICE_CATEGORIES, type Notice, type NoticeCategory } from '../models/notice';
import type { IRecordRepository } from '../repositories/recordRepository';
import type { IClock, IIdGenerator } from '../adapters/adapters';

const TITLE_MIN = 2;
const TITLE_MAX = 80;
const BODY_MIN = 2;
const BODY_MAX = 3000;
export const MAX_PINNED = 3;

export interface NoticeInput
{
    readonly category: NoticeCategory;
    readonly titleKo: string;
    readonly bodyKo: string;
    readonly titleEn: string;
    readonly bodyEn: string;
    readonly pinned: boolean;
    readonly published: boolean;
}

// 📌 고정이 먼저, 그다음 최신 순
function byPinnedThenNewest(a: Notice, b: Notice): number
{
    return Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt);
}

export class NoticeService
{
    private readonly _notices: IRecordRepository<Notice>;
    private readonly _examples: readonly ExampleNoticeDto[];
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;
    private _seeded = false;

    public constructor(notices: IRecordRepository<Notice>, examples: readonly ExampleNoticeDto[], ids: IIdGenerator, clock: IClock)
    {
        this._notices = notices;
        this._examples = examples;
        this._ids = ids;
        this._clock = clock;
    }

    private async _ensureSeededAsync(): Promise<void>
    {
        if (this._seeded)
        {
            return;
        }
        this._seeded = true;
        const now = this._clock.now();
        for (const [index, dto] of this._examples.entries())
        {
            await this._notices.saveAsync(toExampleNotice(dto, index, now));
        }
    }

    private _validate(input: NoticeInput): boolean
    {
        const titleKo = input.titleKo.trim();
        const bodyKo = input.bodyKo.trim();
        return NOTICE_CATEGORIES.includes(input.category)
            && titleKo.length >= TITLE_MIN && titleKo.length <= TITLE_MAX
            && bodyKo.length >= BODY_MIN && bodyKo.length <= BODY_MAX
            && input.titleEn.trim().length <= TITLE_MAX * 2
            && input.bodyEn.trim().length <= BODY_MAX * 2;
    }

    // 고정은 최대 3개 — 넘으면 가장 오래된 고정을 풀어 홈 화면이 길어지지 않게 (POL_NOTICE_02)
    private async _limitPinnedAsync(keepId: string): Promise<void>
    {
        const pinned = await this._notices.findWhereAsync((n) => n.pinned && n.published && n.id !== keepId);
        if (!pinned.ok)
        {
            return;
        }
        const extra = pinned.data.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(MAX_PINNED - 1);
        for (const n of extra)
        {
            await this._notices.saveAsync({ ...n, pinned: false });
        }
    }

    public async listAsync(): Promise<Result<Notice[]>>
    {
        await this._ensureSeededAsync();
        const found = await this._notices.findWhereAsync((n) => n.published);
        return found.ok ? success(found.data.sort(byPinnedThenNewest)) : found;
    }

    public async getAsync(id: string): Promise<Result<Notice>>
    {
        await this._ensureSeededAsync();
        const found = await this._notices.getAsync(id);
        return found.ok && found.data.published ? found : failure(AppError.NotFound);
    }

    // ---------- 운영 콘솔 ----------
    public async listAllAsync(): Promise<Result<Notice[]>>
    {
        await this._ensureSeededAsync();
        const all = await this._notices.getAllAsync();
        return all.ok ? success(all.data.sort(byPinnedThenNewest)) : all;
    }

    public async createAsync(input: NoticeInput): Promise<Result<Notice>>
    {
        await this._ensureSeededAsync();
        if (!this._validate(input))
        {
            return failure(AppError.InvalidInput);
        }
        const now = this._clock.now().toISOString();
        const notice: Notice = {
            id: this._ids.next('n'),
            category: input.category,
            titleKo: input.titleKo.trim(),
            bodyKo: input.bodyKo.trim(),
            titleEn: input.titleEn.trim(),
            bodyEn: input.bodyEn.trim(),
            pinned: input.pinned,
            published: input.published,
            example: false,
            createdAt: now,
            updatedAt: now,
        };
        const saved = await this._notices.saveAsync(notice);
        if (saved.ok && notice.pinned && notice.published)
        {
            await this._limitPinnedAsync(notice.id);
        }
        return saved;
    }

    public async updateAsync(id: string, input: NoticeInput): Promise<Result<Notice>>
    {
        await this._ensureSeededAsync();
        const found = await this._notices.getAsync(id);
        if (!found.ok)
        {
            return failure(AppError.NotFound);
        }
        if (!this._validate(input))
        {
            return failure(AppError.InvalidInput);
        }
        const saved = await this._notices.saveAsync({
            ...found.data,
            category: input.category,
            titleKo: input.titleKo.trim(),
            bodyKo: input.bodyKo.trim(),
            titleEn: input.titleEn.trim(),
            bodyEn: input.bodyEn.trim(),
            pinned: input.pinned,
            published: input.published,
            updatedAt: this._clock.now().toISOString(),
        });
        if (saved.ok && input.pinned && input.published)
        {
            await this._limitPinnedAsync(id);
        }
        return saved;
    }
}
