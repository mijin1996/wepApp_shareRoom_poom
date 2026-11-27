// API 응답 모양: { success, data?, error?: { code, message } } — 에러 코드는 D06-API §4
import { AppError } from '../core/appError';
import type { Result } from '../core/result';

interface IErrorInfo
{
    readonly status: number;
    readonly code: string;
}

const ERROR_TABLE: Readonly<Record<AppError, IErrorInfo>> = {
    [AppError.NotFound]: { status: 404, code: 'COMMON_404' },
    [AppError.Storage]: { status: 500, code: 'COMMON_500' },
    [AppError.InvalidInput]: { status: 400, code: 'COMMON_400' },
    [AppError.Unauthorized]: { status: 401, code: 'AUTH_401' },
    [AppError.Forbidden]: { status: 403, code: 'AUTH_403' },
    [AppError.RoomNotVacant]: { status: 410, code: 'ROOM_410' },
    [AppError.RoomTooSmall]: { status: 422, code: 'ROOM_422' },
    [AppError.HouseholdTooLarge]: { status: 422, code: 'ROOM_422_CONSULT' },
    [AppError.HouseTypeMismatch]: { status: 403, code: 'HOUSE_403' },
    [AppError.ApplicationInProgress]: { status: 409, code: 'APPLY_409' },
    [AppError.NotApproved]: { status: 403, code: 'CONTRACT_403' },
    [AppError.DocumentRequired]: { status: 428, code: 'DOC_428' },
    [AppError.NotPaid]: { status: 403, code: 'MOVEIN_403' },
    [AppError.PaymentFailed]: { status: 402, code: 'PAY_402' },
    [AppError.AlreadyDone]: { status: 409, code: 'COMMON_409' },
    [AppError.TooManyReports]: { status: 429, code: 'REPORT_429' },
    [AppError.ShotTooLarge]: { status: 413, code: 'REPORT_413' },
    [AppError.ResolutionRequired]: { status: 422, code: 'REPORT_422' },
    [AppError.TooManyPosts]: { status: 429, code: 'COMMUNITY_429' },
};

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export function okResponse(data: unknown, status = 200): Response
{
    return new Response(JSON.stringify({ success: true, data }), { status, headers: JSON_HEADERS });
}

export function errorResponse(error: AppError): Response
{
    const info = ERROR_TABLE[error];
    return new Response(JSON.stringify({ success: false, error: { code: info.code, message: error } }), { status: info.status, headers: JSON_HEADERS });
}

export function fromResult<T>(result: Result<T>, map?: (data: T) => unknown, status = 200): Response
{
    return result.ok ? okResponse(map ? map(result.data) : result.data, status) : errorResponse(result.error);
}
