// AuthService: 휴대폰 본인인증 → 세션 (POL_MEMBER_01 · 04)
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { Lang } from '../models/housing';
import type { Gender, IdType, User } from '../models/people';
import type { IRecordRepository } from '../repositories/recordRepository';
import type { IIdGenerator, IIdentityVerifier } from '../adapters/adapters';

const MIN_NAME_LENGTH = 2;
const PHONE_PATTERN = /^\d{10,11}$/;

export interface VerifyInput
{
    readonly name: string;
    readonly phone: string;
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

    public constructor(users: IRecordRepository<User>, sessions: IRecordRepository<Session>, verifier: IIdentityVerifier, ids: IIdGenerator)
    {
        this._users = users;
        this._sessions = sessions;
        this._verifier = verifier;
        this._ids = ids;
    }

    public async verifyAsync(input: VerifyInput): Promise<Result<{ token: string; user: User }>>
    {
        const name = input.name.trim();
        const phone = input.phone.replace(/\D/g, '');
        if (name.length < MIN_NAME_LENGTH || !PHONE_PATTERN.test(phone))
        {
            return failure(AppError.InvalidInput);
        }

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
        };
        const saved = await this._users.saveAsync({ ...user, lang: input.lang });
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
