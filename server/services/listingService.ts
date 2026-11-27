// ListingService: 광고 올리기 · 확인 · 게시 · 내림 — POL_AD_04 ~ 07
// 품은 광고 내용만 확인한다. 계약 · 방값 · 집 보여 주기는 광고주가 직접
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { Advertiser, Listing, ListingDraft } from '../models/advertising';
import type { House, Place, Room, RoomProduct } from '../models/housing';
import type { IHousingRepository } from '../repositories/housingRepository';
import type { IRecordRepository } from '../repositories/recordRepository';
import { addDays, dayOf, isOpen } from '../rules/dates';
import type { IClock, IIdGenerator, INotifier } from '../adapters/adapters';

const TITLE_MIN = 2;
const TITLE_MAX = 40;
const NOTE_MAX = 1000;
const MAX_MONEY = 100_000_000;
const MAX_MONTHS = 24;
const PRODUCTS: readonly RoomProduct[] = ['PRD_ROOM_1', 'PRD_ROOM_2', 'PRD_ROOM_3', 'PRD_ROOM_4'];

function inRange(value: number, min: number, max: number): boolean
{
    return Number.isInteger(value) && value >= min && value <= max;
}

export function isValidDraft(d: ListingDraft): boolean
{
    const title = d.titleKo.trim();
    return title.length >= TITLE_MIN && title.length <= TITLE_MAX
        && d.titleEn.length <= TITLE_MAX
        && (d.houseType === 'mom' || d.houseType === 'dad')
        && inRange(d.bedrooms, 1, 4)
        && d.privateM2 >= 5 && d.privateM2 <= 200
        && d.sharedM2 >= 0 && d.sharedM2 <= 500
        && inRange(d.households, 1, 20)
        && inRange(d.deposit, 0, MAX_MONEY) && inRange(d.rent, 0, MAX_MONEY) && inRange(d.fee, 0, MAX_MONEY)
        && /^\d{4}-\d{2}-\d{2}$/.test(d.availableFrom)
        && inRange(d.minMonths, 1, MAX_MONTHS)
        && d.descriptionKo.length <= NOTE_MAX && d.descriptionEn.length <= NOTE_MAX;
}

export class ListingService
{
    private readonly _listings: IRecordRepository<Listing>;
    private readonly _advertisers: IRecordRepository<Advertiser>;
    private readonly _housing: IHousingRepository;
    private readonly _notifier: INotifier;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;

    public constructor(listings: IRecordRepository<Listing>, advertisers: IRecordRepository<Advertiser>, housing: IHousingRepository,
        notifier: INotifier, ids: IIdGenerator, clock: IClock)
    {
        this._listings = listings;
        this._advertisers = advertisers;
        this._housing = housing;
        this._notifier = notifier;
        this._ids = ids;
        this._clock = clock;
    }

    private today(): string
    {
        return dayOf(this._clock.now());
    }

    public async submitAsync(advertiser: Advertiser, draft: ListingDraft): Promise<Result<Listing>>
    {
        if (advertiser.status !== 'verified')
        {
            return failure(AppError.AdvertiserNotVerified);
        }
        if (!isValidDraft(draft))
        {
            return failure(AppError.InvalidInput);
        }
        const place = await this._placeAsync(draft.placeId);
        if (!place.ok)
        {
            return place;
        }
        const listing: Listing = {
            id: this._ids.next('lst'),
            advertiserId: advertiser.id,
            draft: { ...draft, titleKo: draft.titleKo.trim(), titleEn: draft.titleEn.trim(), descriptionKo: draft.descriptionKo.trim(), descriptionEn: draft.descriptionEn.trim() },
            status: 'review',
            houseId: '',
            roomId: '',
            liveUntil: '',
            topUntil: '',
            rejectReason: '',
            createdAt: this._clock.now().toISOString(),
        };
        const saved = await this._listings.saveAsync(listing);
        if (saved.ok)
        {
            await this._notifier.sendAsync({ to: 'operator', urgent: false, text: `광고 확인 요청 ${listing.id} · ${listing.draft.titleKo}` });
        }
        return saved;
    }

    public async mineAsync(advertiser: Advertiser): Promise<Result<Listing[]>>
    {
        const mine = await this._listings.findWhereAsync((l) => l.advertiserId === advertiser.id);
        return mine.ok ? success([...mine.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) : mine;
    }

    public async getOwnAsync(advertiser: Advertiser, listingId: string): Promise<Result<Listing>>
    {
        const listing = await this._listings.getAsync(listingId);
        if (!listing.ok)
        {
            return listing;
        }
        return listing.data.advertiserId === advertiser.id ? listing : failure(AppError.NotFound);
    }

    // 광고주가 직접 내림 (계약 끝 · 방 나감)
    public async endMineAsync(advertiser: Advertiser, listingId: string): Promise<Result<Listing>>
    {
        const listing = await this.getOwnAsync(advertiser, listingId);
        return listing.ok ? this._endAsync(listing.data) : listing;
    }

    // ---------- 운영 콘솔 ----------
    public async listAllAsync(): Promise<Result<Listing[]>>
    {
        const all = await this._listings.getAllAsync();
        if (!all.ok)
        {
            return all;
        }
        // 확인 기다리는 광고 먼저
        return success([...all.data].sort((a, b) => Number(b.status === 'review') - Number(a.status === 'review') || b.createdAt.localeCompare(a.createdAt)));
    }

    // 확인 끝 → 공인중개사는 구독 중이면 바로 게시, 집주인은 광고비 결제 후 게시
    public async approveAsync(listingId: string): Promise<Result<Listing>>
    {
        const listing = await this._listings.getAsync(listingId);
        if (!listing.ok)
        {
            return listing;
        }
        if (listing.data.status !== 'review')
        {
            return failure(AppError.AlreadyDone);
        }
        const advertiser = await this._advertisers.getAsync(listing.data.advertiserId);
        if (!advertiser.ok)
        {
            return advertiser;
        }
        const subscribed = advertiser.data.kind === 'agent' && advertiser.data.subscriptionUntil !== '' && isOpen(advertiser.data.subscriptionUntil, this.today());
        const result = subscribed
            ? await this._publishAsync({ ...listing.data, status: 'live', liveUntil: advertiser.data.subscriptionUntil })
            : await this._listings.saveAsync({ ...listing.data, status: 'approved' });
        if (result.ok)
        {
            await this._notifier.sendAsync({ to: 'user:' + advertiser.data.userId, urgent: false, text: result.data.status === 'live' ? '광고가 올라갔어요' : '광고 확인이 끝났어요. 결제하면 바로 올라가요' });
        }
        return result;
    }

    public async rejectAsync(listingId: string, reason: string): Promise<Result<Listing>>
    {
        const listing = await this._listings.getAsync(listingId);
        if (!listing.ok)
        {
            return listing;
        }
        if (listing.data.status !== 'review')
        {
            return failure(AppError.AlreadyDone);
        }
        if (reason.trim().length < 2)
        {
            return failure(AppError.InvalidInput);
        }
        return this._listings.saveAsync({ ...listing.data, status: 'rejected', rejectReason: reason.trim().slice(0, 200) });
    }

    // 허위 매물 신고 등으로 운영 매니저가 내림
    public async forceEndAsync(listingId: string): Promise<Result<Listing>>
    {
        const listing = await this._listings.getAsync(listingId);
        return listing.ok ? this._endAsync(listing.data) : listing;
    }

    // ---------- 결제 뒤 (BillingService 가 부름) ----------
    public async activateAsync(listingId: string, until: string): Promise<Result<Listing>>
    {
        const listing = await this._listings.getAsync(listingId);
        if (!listing.ok)
        {
            return listing;
        }
        if (listing.data.status !== 'approved' && listing.data.status !== 'live')
        {
            return failure(AppError.AlreadyDone);
        }
        return this._publishAsync({ ...listing.data, status: 'live', liveUntil: until });
    }

    public async setTopAsync(listingId: string, until: string): Promise<Result<Listing>>
    {
        const listing = await this._listings.getAsync(listingId);
        if (!listing.ok)
        {
            return listing;
        }
        if (listing.data.status !== 'live')
        {
            return failure(AppError.InvalidInput);
        }
        return this._publishAsync({ ...listing.data, topUntil: until });
    }

    // 공인중개사 구독을 늘리면 확인 끝난 광고 · 게시 중인 광고 모두 같은 날까지
    public async syncAgentAsync(advertiserId: string, until: string): Promise<Result<number>>
    {
        const mine = await this._listings.findWhereAsync((l) => l.advertiserId === advertiserId && (l.status === 'approved' || l.status === 'live'));
        if (!mine.ok)
        {
            return mine;
        }
        for (const listing of mine.data)
        {
            const done = await this._publishAsync({ ...listing, status: 'live', liveUntil: until });
            if (!done.ok)
            {
                return done;
            }
        }
        return success(mine.data.length);
    }

    private async _endAsync(listing: Listing): Promise<Result<Listing>>
    {
        if (listing.status === 'ended' || listing.status === 'rejected')
        {
            return failure(AppError.AlreadyDone);
        }
        const ended: Listing = { ...listing, status: 'ended', liveUntil: addDays(this.today(), -1), topUntil: '' };
        return ended.houseId ? this._publishAsync(ended) : this._listings.saveAsync(ended);
    }

    private async _placeAsync(placeId: string): Promise<Result<Place>>
    {
        const places = await this._housing.getPlacesAsync();
        if (!places.ok)
        {
            return places;
        }
        const place = places.data.find((p) => p.id === placeId && (p.kind === 'gu' || p.kind === 'dong'));
        return place ? success(place) : failure(AppError.InvalidInput);
    }

    // 광고 → 방 찾기에 보이는 House · Room 으로 (정확한 위치 대신 동 · 구 중심만)
    private async _publishAsync(listing: Listing): Promise<Result<Listing>>
    {
        const advertiser = await this._advertisers.getAsync(listing.advertiserId);
        if (!advertiser.ok)
        {
            return advertiser;
        }
        const place = await this._placeAsync(listing.draft.placeId);
        if (!place.ok)
        {
            return place;
        }
        const places = await this._housing.getPlacesAsync();
        const guPlace = places.ok ? places.data.find((p) => p.kind === 'gu' && p.gu === place.data.gu) : undefined;
        const d = listing.draft;
        const houseId = listing.houseId || 'h-' + listing.id;
        const roomId = listing.roomId || 'r-' + listing.id;
        const a = advertiser.data;
        const house: House = {
            id: houseId,
            nameKo: d.titleKo,
            nameEn: d.titleEn || d.titleKo,
            type: d.houseType,
            gu: place.data.gu,
            guEn: guPlace?.nameEn ?? place.data.gu,
            dong: place.data.kind === 'dong' ? place.data.nameKo : '',
            dongEn: place.data.kind === 'dong' ? place.data.nameEn : '',
            dongCenter: place.data.location,
            location: place.data.location,
            buildingType: d.buildingType,
            elevator: d.elevator,
            noStairs: d.noStairs,
            playroom: false,
            parking: d.parking,
            foreignerOk: d.foreignerOk,
            englishStaff: false,
            moveOutCleaningFee: 0,
            minMonths: d.minMonths,
            maxMonths: MAX_MONTHS,
            sharedM2: d.sharedM2,
            households: d.households,
            rulesKo: [],
            rulesEn: [],
            pois: [],
            listing: {
                advertiserId: a.id,
                listedBy: a.kind,
                advertiserNameKo: a.nameKo,
                advertiserNameEn: a.nameEn || a.nameKo,
                agentRegNo: a.agentRegNo,
                liveUntil: listing.liveUntil,
                topUntil: listing.topUntil,
                noteKo: d.descriptionKo,
                noteEn: d.descriptionEn || d.descriptionKo,
                example: false,
            },
        };
        const room: Room = {
            id: roomId,
            houseId,
            product: PRODUCTS[Math.min(d.bedrooms, PRODUCTS.length) - 1],
            bedrooms: d.bedrooms,
            privateM2: d.privateM2,
            privateBath: d.privateBath,
            deposit: d.deposit,
            rent: d.rent,
            fee: d.fee,
            availableFrom: d.availableFrom,
            status: 'vacant',
        };
        const published = await this._housing.saveListingAsync(house, [room]);
        if (!published.ok)
        {
            return published;
        }
        return this._listings.saveAsync({ ...listing, houseId, roomId });
    }
}
