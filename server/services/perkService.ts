// PerkService: 혜택 메뉴 — 제휴 할인 · 기업 후원 · 기관 지원 (POL_PERK)
// 제휴 업체 · 후원 기업 · 기관이 품에 돈을 내고, 한부모 가족은 0원. 이용 수를 세어 정산 · 보고에 씀
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { ExamplePerkDto } from '../dtos/adDto';
import { toExamplePerk } from '../mappers/adMapper';
import { PERK_ACTIONS, PERK_KINDS, type Perk, type PerkAction, type PerkKind, type PerkRequest } from '../models/perk';
import type { User } from '../models/people';
import type { IRecordRepository } from '../repositories/recordRepository';
import type { IClock, IIdGenerator, INotifier } from '../adapters/adapters';

const TITLE_MIN = 2;
const TITLE_MAX = 60;
const DESC_MAX = 1000;
const NOTE_MAX = 500;
const REQUESTS_PER_PERK = 1;     // 같은 혜택은 한 번만 신청

export interface PerkInput
{
    readonly kind: PerkKind;
    readonly action: PerkAction;
    readonly url: string;
    readonly providerKo: string;
    readonly providerEn: string;
    readonly titleKo: string;
    readonly titleEn: string;
    readonly descKo: string;
    readonly descEn: string;
    readonly active: boolean;
}

export interface PerkAdminRow
{
    readonly perk: Perk;
    readonly requests: number;
}

export class PerkService
{
    private readonly _perks: IRecordRepository<Perk>;
    private readonly _requests: IRecordRepository<PerkRequest>;
    private readonly _examples: readonly ExamplePerkDto[];
    private readonly _notifier: INotifier;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;
    private _seeded = false;

    public constructor(perks: IRecordRepository<Perk>, requests: IRecordRepository<PerkRequest>, examples: readonly ExamplePerkDto[],
        notifier: INotifier, ids: IIdGenerator, clock: IClock)
    {
        this._perks = perks;
        this._requests = requests;
        this._examples = examples;
        this._notifier = notifier;
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
        const now = this._clock.now().toISOString();
        for (const [index, dto] of this._examples.entries())
        {
            await this._perks.saveAsync(toExamplePerk(dto, index, now));
        }
    }

    public async listAsync(kind: PerkKind | undefined): Promise<Result<Perk[]>>
    {
        await this._ensureSeededAsync();
        const list = await this._perks.findWhereAsync((p) => p.active && (!kind || p.kind === kind));
        return list.ok ? success([...list.data].sort((a, b) => PERK_KINDS.indexOf(a.kind) - PERK_KINDS.indexOf(b.kind) || b.createdAt.localeCompare(a.createdAt))) : list;
    }

    private async _activeAsync(id: string): Promise<Result<Perk>>
    {
        await this._ensureSeededAsync();
        const perk = await this._perks.getAsync(id);
        if (!perk.ok)
        {
            return perk;
        }
        return perk.data.active ? perk : failure(AppError.NotFound);
    }

    // 제휴 업체로 이동: 이용 수만 세고 누가 눌렀는지는 남기지 않음
    public async openAsync(id: string): Promise<Result<string>>
    {
        const perk = await this._activeAsync(id);
        if (!perk.ok)
        {
            return perk;
        }
        if (perk.data.action !== 'link' || !perk.data.url)
        {
            return failure(AppError.InvalidInput);
        }
        const saved = await this._perks.saveAsync({ ...perk.data, clicks: perk.data.clicks + 1 });
        return saved.ok ? success(perk.data.url) : saved;
    }

    // 후원 · 기관 지원 · 업체 연결 신청 (운영 매니저가 연결)
    public async requestAsync(user: User, id: string, note: string): Promise<Result<PerkRequest>>
    {
        const perk = await this._activeAsync(id);
        if (!perk.ok)
        {
            return perk;
        }
        if (perk.data.action !== 'request' || note.length > NOTE_MAX)
        {
            return failure(AppError.InvalidInput);
        }
        const mine = await this._requests.findWhereAsync((r) => r.userId === user.id && r.perkId === id);
        if (!mine.ok)
        {
            return mine;
        }
        if (mine.data.length >= REQUESTS_PER_PERK)
        {
            return failure(AppError.AlreadyDone);
        }
        const request: PerkRequest = { id: this._ids.next('preq'), perkId: id, userId: user.id, note: note.trim(), createdAt: this._clock.now().toISOString() };
        const saved = await this._requests.saveAsync(request);
        if (saved.ok)
        {
            await this._perks.saveAsync({ ...perk.data, clicks: perk.data.clicks + 1 });
            await this._notifier.sendAsync({ to: 'operator', urgent: false, text: `혜택 신청 · ${perk.data.titleKo}` });
        }
        return saved;
    }

    public async myRequestsAsync(user: User): Promise<Result<string[]>>
    {
        const mine = await this._requests.findWhereAsync((r) => r.userId === user.id);
        return mine.ok ? success(mine.data.map((r) => r.perkId)) : mine;
    }

    // ---------- 운영 콘솔 ----------
    public async listAllAsync(): Promise<Result<PerkAdminRow[]>>
    {
        await this._ensureSeededAsync();
        const [perks, requests] = await Promise.all([this._perks.getAllAsync(), this._requests.getAllAsync()]);
        if (!perks.ok)
        {
            return perks;
        }
        if (!requests.ok)
        {
            return requests;
        }
        return success(perks.data
            .map((perk) => ({ perk, requests: requests.data.filter((r) => r.perkId === perk.id).length }))
            .sort((a, b) => b.perk.createdAt.localeCompare(a.perk.createdAt)));
    }

    public async listRequestsAsync(): Promise<Result<PerkRequest[]>>
    {
        const all = await this._requests.getAllAsync();
        return all.ok ? success([...all.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) : all;
    }

    private _valid(input: PerkInput): boolean
    {
        const title = input.titleKo.trim();
        return PERK_KINDS.includes(input.kind) && PERK_ACTIONS.includes(input.action)
            && title.length >= TITLE_MIN && title.length <= TITLE_MAX && input.titleEn.length <= TITLE_MAX
            && input.providerKo.trim().length >= 1 && input.descKo.length <= DESC_MAX && input.descEn.length <= DESC_MAX
            && (input.action === 'request' || /^https:\/\/\S+$/.test(input.url.trim()));
    }

    private _fields(input: PerkInput)
    {
        return {
            kind: input.kind,
            action: input.action,
            url: input.action === 'link' ? input.url.trim() : '',
            providerKo: input.providerKo.trim(),
            providerEn: input.providerEn.trim() || input.providerKo.trim(),
            titleKo: input.titleKo.trim(),
            titleEn: input.titleEn.trim(),
            descKo: input.descKo.trim(),
            descEn: input.descEn.trim(),
            active: input.active,
        };
    }

    public async createAsync(input: PerkInput): Promise<Result<Perk>>
    {
        if (!this._valid(input))
        {
            return failure(AppError.InvalidInput);
        }
        await this._ensureSeededAsync();
        return this._perks.saveAsync({ id: this._ids.next('perk'), ...this._fields(input), example: false, clicks: 0, createdAt: this._clock.now().toISOString() });
    }

    public async updateAsync(id: string, input: PerkInput): Promise<Result<Perk>>
    {
        if (!this._valid(input))
        {
            return failure(AppError.InvalidInput);
        }
        await this._ensureSeededAsync();
        const perk = await this._perks.getAsync(id);
        return perk.ok ? this._perks.saveAsync({ ...perk.data, ...this._fields(input) }) : perk;
    }
}
