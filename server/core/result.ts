// Result 패턴: 성공과 실패를 값으로 돌려준다 (개념편 6.3)
// 받는 쪽은 if (result.ok) 로 두 경우를 모두 처리해야 한다.
import { AppError } from './appError';

export interface ISuccess<T>
{
    readonly ok: true;
    readonly data: T;
}

export interface IFailure
{
    readonly ok: false;
    readonly error: AppError;
}

export type Result<T> = ISuccess<T> | IFailure;

export function success<T>(data: T): ISuccess<T>
{
    return { ok: true, data };
}

export function failure(error: AppError): IFailure
{
    return { ok: false, error };
}
