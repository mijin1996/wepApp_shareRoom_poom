// AdvertiserService: 광고주 등록 · 확인 — POL_AD_02 · 03
// 공인중개사는 등록번호, 집주인은 소유 확인 서류. 운영 매니저가 확인해야 광고를 올릴 수 있다
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { Advertiser } from '../models/advertising';
import type { AdvertiserKind } from '../models/housing';
import type { User } from '../models/people';
import type { IRecordRepository } from '../repositories/recordRepository';
import type { IClock, IIdGenerator, INotifier } from '../adapters/adapters';

const NAME_MIN = 2;
const NAME_MAX = 40;
const AGENT_REG_NO = /^[0-9-]{5,30}$/;     // 공인중개사 사무소 등록번호 (숫자 · 하이픈)

export interface RegisterInput
{
    readonly kind: AdvertiserKind;
    readonly nameKo: string;
    readonly nameEn: string;
    readonly agentRegNo: string;
    readonly ownershipDoc: boolean;
}

export class AdvertiserService
{
    private readonly _advertisers: IRecordRepository<Advertiser>;
    private readonly _notifier: INotifier;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;

    public constructor(advertisers: IRecordRepository<Advertiser>, notifier: INotifier, ids: IIdGenerator, clock: IClock)
    {
        this._advertisers = advertisers;
        this._notifier = notifier;
        this._ids = ids;
        this._clock = clock;
    }

    public async registerAsync(user: User, input: RegisterInput): Promise<Result<Advertiser>>
    {
        const nameKo = input.nameKo.trim();
        if (nameKo.length < NAME_MIN || nameKo.length > NAME_MAX)
        {
            return failure(AppError.InvalidInput);
        }
        // 남의 집 광고는 공인중개사만, 집주인은 자기 집만 (공인중개사법 표시 · 광고)
        if (input.kind === 'agent' && !AGENT_REG_NO.test(input.agentRegNo.trim()))
        {
            return failure(AppError.InvalidInput);
        }
        if (input.kind === 'owner' && !input.ownershipDoc)
        {
            return failure(AppError.DocumentRequired);
        }
        const existing = await this.mineAsync(user);
        if (existing.ok)
        {
            return failure(AppError.AlreadyDone);
        }

        const advertiser: Advertiser = {
            id: this._ids.next('adv'),
            userId: user.id,
            kind: input.kind,
            nameKo,
            nameEn: input.nameEn.trim().slice(0, NAME_MAX),
            agentRegNo: input.kind === 'agent' ? input.agentRegNo.trim() : '',
            ownershipDoc: input.kind === 'owner' && input.ownershipDoc,
            status: 'pending',
            subscriptionUntil: '',
            createdAt: this._clock.now().toISOString(),
        };
        const saved = await this._advertisers.saveAsync(advertiser);
        if (saved.ok)
        {
            await this._notifier.sendAsync({ to: 'operator', urgent: false, text: `광고주 확인 요청 ${advertiser.id} · ${advertiser.kind === 'agent' ? '공인중개사 ' + advertiser.agentRegNo : '집주인'}` });
        }
        return saved;
    }

    public async mineAsync(user: User): Promise<Result<Advertiser>>
    {
        const mine = await this._advertisers.findWhereAsync((a) => a.userId === user.id);
        if (!mine.ok)
        {
            return mine;
        }
        return mine.data.length > 0 ? success(mine.data[0]) : failure(AppError.NotFound);
    }

    // 광고를 올리거나 결제하려면 확인된 광고주여야 한다
    public async verifiedOfAsync(user: User): Promise<Result<Advertiser>>
    {
        const mine = await this.mineAsync(user);
        if (!mine.ok)
        {
            return mine.error === AppError.NotFound ? failure(AppError.AdvertiserNotVerified) : mine;
        }
        return mine.data.status === 'verified' ? mine : failure(AppError.AdvertiserNotVerified);
    }

    // ---------- 운영 콘솔 ----------
    public async listAllAsync(): Promise<Result<Advertiser[]>>
    {
        const all = await this._advertisers.getAllAsync();
        return all.ok ? success([...all.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) : all;
    }

    public async verifyAsync(id: string, approve: boolean): Promise<Result<Advertiser>>
    {
        const advertiser = await this._advertisers.getAsync(id);
        if (!advertiser.ok)
        {
            return advertiser;
        }
        const saved = await this._advertisers.saveAsync({ ...advertiser.data, status: approve ? 'verified' : 'rejected' });
        if (saved.ok)
        {
            await this._notifier.sendAsync({ to: 'user:' + advertiser.data.userId, urgent: false, text: approve ? '광고주 확인이 끝났어요. 이제 방을 올릴 수 있어요' : '광고주 확인이 어려워요. 등록번호 · 서류를 다시 확인해 주세요' });
        }
        return saved;
    }
}
