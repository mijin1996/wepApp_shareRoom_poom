// 외부 서비스는 인터페이스 뒤에 (전략 패턴). Mock 모드는 가짜, Real 모드는 업체 구현으로 바꿔 끼운다
import type { Gender, IdType, PayMethod } from '../models/people';

// ---------- 시계 (테스트에서 날짜를 고정하려고) ----------
export interface IClock
{
    now(): Date;
}

export class SystemClock implements IClock
{
    public now(): Date
    {
        return new Date();
    }
}

export class FixedClock implements IClock
{
    private _time: number;

    public constructor(iso: string)
    {
        this._time = Date.parse(iso);
    }

    public now(): Date
    {
        return new Date(this._time);
    }

    public advanceMinutes(minutes: number): void
    {
        this._time += minutes * 60 * 1000;
    }
}

// ---------- 본인인증 ----------
export interface IdentityInput
{
    readonly name: string;
    readonly phone: string;
    readonly gender: Gender;
    readonly idType: IdType;
}

export interface IdentityResult
{
    readonly verified: boolean;     // 외국인 본인 명의 휴대폰이 없으면 false (상담 때 확인)
    readonly ciHash: string;
}

export interface IIdentityVerifier
{
    verifyAsync(input: IdentityInput): Promise<IdentityResult>;
}

export class MockIdentityVerifier implements IIdentityVerifier
{
    public async verifyAsync(input: IdentityInput): Promise<IdentityResult>
    {
        const digits = input.phone.replace(/\D/g, '');
        return {
            verified: input.idType === 'kr' || digits.startsWith('010'),
            ciHash: 'mock-' + digits,
        };
    }
}

// ---------- 결제 ----------
export interface ChargeResult
{
    readonly approved: boolean;
    readonly transactionId: string;
}

export interface IPaymentGateway
{
    chargeAsync(amount: number, method: PayMethod, orderId: string): Promise<ChargeResult>;
}

export const MOCK_FAIL_AMOUNT = 4020000;    // 테스트용: 이 금액이면 결제 실패

export class MockPaymentGateway implements IPaymentGateway
{
    public async chargeAsync(amount: number, method: PayMethod, orderId: string): Promise<ChargeResult>
    {
        const approved = amount > 0 && amount !== MOCK_FAIL_AMOUNT;
        return { approved, transactionId: `mock-${method}-${orderId}` };
    }
}

// ---------- 알림 (문자 · 메일) ----------
export interface Notice
{
    readonly to: string;            // 'user:<id>' | 'operator' | 'owner'
    readonly urgent: boolean;
    readonly text: string;
}

export interface INotifier
{
    sendAsync(notice: Notice): Promise<void>;
}

export class MemoryNotifier implements INotifier
{
    private readonly _sent: Notice[] = [];
    private readonly _quiet: boolean;

    public constructor(quiet = false)
    {
        this._quiet = quiet;
    }

    public async sendAsync(notice: Notice): Promise<void>
    {
        this._sent.push(notice);
        if (!this._quiet)
        {
            console.log(`[알림${notice.urgent ? ' · 긴급' : ''}] → ${notice.to}: ${notice.text}`);
        }
    }

    public get sent(): readonly Notice[]
    {
        return this._sent;
    }
}

// ---------- 아이디 만들기 ----------
export interface IIdGenerator
{
    next(prefix: string): string;
}

export class RandomIdGenerator implements IIdGenerator
{
    public next(prefix: string): string
    {
        return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
}

export class SequentialIdGenerator implements IIdGenerator
{
    private _count = 0;

    public next(prefix: string): string
    {
        this._count += 1;
        return `${prefix}-${this._count}`;
    }
}
