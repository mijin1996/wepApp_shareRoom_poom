// 테스트 대역: 시계 · 아이디를 고정해 언제 돌려도 같은 결과 (F.I.R.S.T)
import { FixedClock, MemoryNotifier, SequentialIdGenerator, type IPaymentGateway } from '../server/adapters/adapters';
import { createContainer } from '../server/container';
import type { Result } from '../server/core/result';
import type { User } from '../server/models/people';

export const TODAY = '2026-11-27T10:00:00+09:00';

export function makeContainer(gateway?: IPaymentGateway)
{
    const clock = new FixedClock(TODAY);
    const notifier = new MemoryNotifier(true);
    const c = createContainer({ clock, notifier, ids: new SequentialIdGenerator(), gateway });
    return { c, clock, notifier };
}

// 항상 거절하는 결제사 (Mock)
export class DecliningGateway implements IPaymentGateway
{
    public async chargeAsync(): Promise<{ approved: boolean; transactionId: string }>
    {
        return { approved: false, transactionId: 'declined' };
    }
}

export function unwrap<T>(result: Result<T>): T
{
    if (!result.ok)
    {
        throw new Error('실패: ' + result.error);
    }
    return result.data;
}

export async function signUpAsync(c: ReturnType<typeof createContainer>, gender: 'f' | 'm' = 'f', phone = '01012345678'): Promise<User>
{
    const verified = await c.auth.verifyAsync({ name: '김한별', phone, birthYear: 1990, gender, idType: 'kr', lang: 'ko' });
    return unwrap(verified).user;
}
