// BillingService: 광고 상품 결제 · 문의당 과금 · 월말 정산 — POL_AD_08 ~ 10
// 품이 받는 돈은 광고비 · 구독료 · 상단 노출 · 문의 1건 — 모두 계약 성사와 무관한 고정 금액 (공인중개사법)
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { AdProduct, Advertiser, Charge, Listing, ProductId } from '../models/advertising';
import type { PayMethod } from '../models/people';
import type { IRecordRepository } from '../repositories/recordRepository';
import { dayOf, extend } from '../rules/dates';
import type { ListingService } from './listingService';
import type { IClock, IIdGenerator, IPaymentGateway } from '../adapters/adapters';

const PAY_METHODS: readonly PayMethod[] = ['card', 'transfer', 'easy'];

// 문의가 들어올 때 부르는 쪽(ApplicationService)이 아는 것만 (ISP)
export interface ILeadBilling
{
    recordLeadAsync(advertiserId: string, listingId: string, inquiryId: string): Promise<Result<Charge | undefined>>;
}

export interface Statement
{
    readonly charges: readonly Charge[];
    readonly unpaidTotal: number;     // 이번 달 정산할 문의 과금
    readonly paidTotal: number;
}

export interface RevenueRow
{
    readonly productId: ProductId;
    readonly count: number;
    readonly paid: number;
    readonly unpaid: number;
}

export class BillingService implements ILeadBilling
{
    private readonly _products: readonly AdProduct[];
    private readonly _charges: IRecordRepository<Charge>;
    private readonly _advertisers: IRecordRepository<Advertiser>;
    private readonly _listings: ListingService;
    private readonly _gateway: IPaymentGateway;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;

    public constructor(products: readonly AdProduct[], charges: IRecordRepository<Charge>, advertisers: IRecordRepository<Advertiser>,
        listings: ListingService, gateway: IPaymentGateway, ids: IIdGenerator, clock: IClock)
    {
        this._products = products;
        this._charges = charges;
        this._advertisers = advertisers;
        this._listings = listings;
        this._gateway = gateway;
        this._ids = ids;
        this._clock = clock;
    }

    public products(): readonly AdProduct[]
    {
        return this._products;
    }

    private product(id: ProductId): AdProduct | undefined
    {
        return this._products.find((p) => p.id === id);
    }

    public async buyAsync(advertiser: Advertiser, productId: ProductId, listingId: string, method: PayMethod): Promise<Result<Charge>>
    {
        if (advertiser.status !== 'verified')
        {
            return failure(AppError.AdvertiserNotVerified);
        }
        const product = this.product(productId);
        // 문의당 과금은 사는 상품이 아님. 공인중개사 상품은 공인중개사만, 집주인 상품은 집주인만
        if (!product || product.id === 'AD_LEAD' || (product.forKind !== 'both' && product.forKind !== advertiser.kind) || !PAY_METHODS.includes(method))
        {
            return failure(AppError.InvalidInput);
        }
        const today = dayOf(this._clock.now());

        let listing: Listing | undefined;
        if (product.id !== 'AD_AGENT_MONTH')
        {
            const own = await this._listings.getOwnAsync(advertiser, listingId);
            if (!own.ok)
            {
                return own;
            }
            listing = own.data;
            const ok = product.id === 'AD_TOP_7D' ? listing.status === 'live' : listing.status === 'approved' || listing.status === 'live';
            if (!ok)
            {
                return failure(AppError.InvalidInput);
            }
        }

        const charge = await this._payAsync(advertiser, product, listing?.id ?? '', method);
        if (!charge.ok)
        {
            return charge;
        }

        // 결제가 끝난 뒤에만 기간을 늘린다
        if (product.id === 'AD_AGENT_MONTH')
        {
            const until = extend(advertiser.subscriptionUntil, today, product.days);
            const saved = await this._advertisers.saveAsync({ ...advertiser, subscriptionUntil: until });
            if (!saved.ok)
            {
                return saved;
            }
            const synced = await this._listings.syncAgentAsync(advertiser.id, until);
            return synced.ok ? charge : synced;
        }
        if (listing && product.id === 'AD_OWNER_30D')
        {
            const live = await this._listings.activateAsync(listing.id, extend(listing.status === 'live' ? listing.liveUntil : '', today, product.days));
            return live.ok ? charge : live;
        }
        if (listing)
        {
            const top = await this._listings.setTopAsync(listing.id, extend(listing.topUntil, today, product.days));
            return top.ok ? charge : top;
        }
        return charge;
    }

    private async _payAsync(advertiser: Advertiser, product: AdProduct, listingId: string, method: PayMethod): Promise<Result<Charge>>
    {
        const id = this._ids.next('chg');
        const paid = await this._gateway.chargeAsync(product.price, method, id);
        if (!paid.approved)
        {
            return failure(AppError.PaymentFailed);
        }
        return this._charges.saveAsync({
            id,
            advertiserId: advertiser.id,
            productId: product.id,
            amount: product.price,
            listingId,
            inquiryId: '',
            paid: true,
            createdAt: this._clock.now().toISOString(),
        });
    }

    // 공인중개사 광고에 한부모 가족 문의가 오면 1건 과금 (월말 정산). 집주인 광고는 30일 광고비에 포함
    public async recordLeadAsync(advertiserId: string, listingId: string, inquiryId: string): Promise<Result<Charge | undefined>>
    {
        const advertiser = await this._advertisers.getAsync(advertiserId);
        if (!advertiser.ok)
        {
            // 예시 광고(광고주 기록 없음)는 과금하지 않음
            return advertiser.error === AppError.NotFound ? success(undefined) : advertiser;
        }
        const lead = this.product('AD_LEAD');
        if (advertiser.data.kind !== 'agent' || !lead || lead.price === 0)
        {
            return success(undefined);
        }
        return this._charges.saveAsync({
            id: this._ids.next('chg'),
            advertiserId,
            productId: 'AD_LEAD',
            amount: lead.price,
            listingId,
            inquiryId,
            paid: false,
            createdAt: this._clock.now().toISOString(),
        });
    }

    public async statementAsync(advertiser: Advertiser): Promise<Result<Statement>>
    {
        const mine = await this._charges.findWhereAsync((c) => c.advertiserId === advertiser.id);
        if (!mine.ok)
        {
            return mine;
        }
        const charges = [...mine.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const sum = (paid: boolean) => charges.filter((c) => c.paid === paid).reduce((total, c) => total + c.amount, 0);
        return success({ charges, unpaidTotal: sum(false), paidTotal: sum(true) });
    }

    // 쌓인 문의 과금을 한 번에 결제
    public async settleAsync(advertiser: Advertiser, method: PayMethod): Promise<Result<number>>
    {
        if (!PAY_METHODS.includes(method))
        {
            return failure(AppError.InvalidInput);
        }
        const unpaid = await this._charges.findWhereAsync((c) => c.advertiserId === advertiser.id && !c.paid);
        if (!unpaid.ok)
        {
            return unpaid;
        }
        const total = unpaid.data.reduce((sum, c) => sum + c.amount, 0);
        if (total === 0)
        {
            return failure(AppError.AlreadyDone);
        }
        const paid = await this._gateway.chargeAsync(total, method, this._ids.next('settle'));
        if (!paid.approved)
        {
            return failure(AppError.PaymentFailed);
        }
        for (const charge of unpaid.data)
        {
            const saved = await this._charges.saveAsync({ ...charge, paid: true });
            if (!saved.ok)
            {
                return saved;
            }
        }
        return success(total);
    }

    // ---------- 운영 콘솔: 상품별 매출 ----------
    public async revenueAsync(): Promise<Result<RevenueRow[]>>
    {
        const all = await this._charges.getAllAsync();
        if (!all.ok)
        {
            return all;
        }
        return success(this._products.map((p) =>
        {
            const mine = all.data.filter((c) => c.productId === p.id);
            return {
                productId: p.id,
                count: mine.length,
                paid: mine.filter((c) => c.paid).reduce((s, c) => s + c.amount, 0),
                unpaid: mine.filter((c) => !c.paid).reduce((s, c) => s + c.amount, 0),
            };
        }));
    }
}
