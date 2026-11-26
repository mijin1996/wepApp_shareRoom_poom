// AuthService: 휴대폰 본인인증 → 세션 (POL_MEMBER_01 · 04)
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { Lang } from '../models/housing';
import type { Gender, IdType, User } from '../models/people';
import type { IRecordRepository } from '../repositories/recordRepository';
import type { IClock, IIdGenerator, IIdentityVerifier } from '../adapters/adapters';

// 부모 나이 제한 없음 (POL_MEMBER_01). 만 19세 미만 부모는 계약 때 법정대리인 동의를 함께 받는다 (POL_MEMBER_05)
const ADULT_AGE = 19;
const OLDEST_BIRTH_YEAR = 1900;
const MIN_NAME_LENGTH = 2;
const PHONE_PATTERN = /^\d{10,11}$/;

export interface VerifyInput
{
    readonly name: string;
    readonly phone: string;
    readonly birthYear: number;
    readonly gender: Gender;
    readonly idType: IdType;
    readonly lang: Lang;
}

export interface Session
{
    readonly id: string;              // 토큰
    readonly userId: string;
}

export class AuthService
{
    private readonly _users: IRecordRepository<User>;
    private readonly _sessions: IRecordRepository<Session>;
    private readonly _verifier: IIdentityVerifier;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;

    public constructor(users: IRecordRepository<User>, sessions: IRecordRepository<Session>, verifier: IIdentityVerifier, ids: IIdGenerator, clock: IClock)
    {
        this._users = users;
        this._sessions = sessions;
        this._verifier = verifier;
        this._ids = ids;
        this._clock = clock;
    }

    public async verifyAsync(input: VerifyInput): Promise<Result<{ token: string; user: User }>>
    {
        const name = input.name.trim();
        const phone = input.phone.replace(/\D/g, '');
        if (name.length < MIN_NAME_LENGTH || !PHONE_PATTERN.test(phone) || !Number.isInteger(input.birthYear))
        {
            return failure(AppError.InvalidInput);
        }
        const thisYear = this._clock.now().getFullYear();
        if (input.birthYear < OLDEST_BIRTH_YEAR || input.birthYear > thisYear)
        {
            return failure(AppError.InvalidInput);
        }
        const minorParent = thisYear - input.birthYear < ADULT_AGE;

        const identity = await this._verifier.verifyAsync({ ...input, name, phone });
        const existing = await this._users.findWhereAsync((u) => u.phone === phone);
        if (!existing.ok)
        {
            return existing;
        }
        const user: User = existing.data[0] ?? {
            id: this._ids.next('u'),
            name,
            phone,
            gender: input.gender,
            lang: input.lang,
            idType: input.idType,
            verified: identity.verified,
            minorParent,
        };
        const saved = await this._users.saveAsync({ ...user, lang: input.lang, minorParent });
        if (!saved.ok)
        {
            return saved;
        }
        const token = this._ids.next('s') + crypto.randomUUID();
        const session = await this._sessions.saveAsync({ id: token, userId: user.id });
        return session.ok ? success({ token, user: saved.data }) : session;
    }

    public async userByTokenAsync(token: string | undefined): Promise<Result<User>>
    {
        if (!token)
        {
            return failure(AppError.Unauthorized);
        }
        const session = await this._sessions.getAsync(token);
        if (!session.ok)
        {
            return failure(AppError.Unauthorized);
        }
        return this._users.getAsync(session.data.userId);
    }
}
