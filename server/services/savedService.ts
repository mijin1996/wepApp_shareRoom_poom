// SavedService: 관심 방 · 빈방 알림 · 집 빌려주기 문의 — REQ_035 · 039
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { Favorite, PartnerInquiry, SavedSearch } from '../models/feedback';
import type { User } from '../models/people';
import type { IRecordRepository } from '../repositories/recordRepository';
import type { IClock, IIdGenerator, INotifier } from '../adapters/adapters';

const MAX_SAVED_SEARCHES = 5;
const MAX_QUERY = 300;

export class SavedService
{
    private readonly _favorites: IRecordRepository<Favorite>;
    private readonly _searches: IRecordRepository<SavedSearch>;
    private readonly _partners: IRecordRepository<PartnerInquiry>;
    private readonly _notifier: INotifier;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;

    public constructor(favorites: IRecordRepository<Favorite>, searches: IRecordRepository<SavedSearch>, partners: IRecordRepository<PartnerInquiry>,
        notifier: INotifier, ids: IIdGenerator, clock: IClock)
    {
        this._favorites = favorites;
        this._searches = searches;
        this._partners = partners;
        this._notifier = notifier;
        this._ids = ids;
        this._clock = clock;
    }

    public async toggleFavoriteAsync(user: User, roomId: string): Promise<Result<boolean>>
    {
        const id = `${user.id}|${roomId}`;
        const existing = await this._favorites.getAsync(id);
        if (existing.ok)
        {
            const removed = await this._favorites.deleteAsync(id);
            return removed.ok ? success(false) : removed;
        }
        const saved = await this._favorites.saveAsync({ id, userId: user.id, roomId });
        return saved.ok ? success(true) : saved;
    }

    public async favoritesAsync(user: User): Promise<Result<string[]>>
    {
        const mine = await this._favorites.findWhereAsync((f) => f.userId === user.id);
        return mine.ok ? success(mine.data.map((f) => f.roomId)) : mine;
    }

    public async saveSearchAsync(user: User, query: string): Promise<Result<SavedSearch>>
    {
        const mine = await this._searches.findWhereAsync((s) => s.userId === user.id);
        if (!mine.ok)
        {
            return mine;
        }
        if (mine.data.length >= MAX_SAVED_SEARCHES || query.length > MAX_QUERY)
        {
            return failure(AppError.InvalidInput);
        }
        return this._searches.saveAsync({ id: this._ids.next('ss'), userId: user.id, query, createdAt: this._clock.now().toISOString() });
    }

    public async searchesAsync(user: User): Promise<Result<SavedSearch[]>>
    {
        return this._searches.findWhereAsync((s) => s.userId === user.id);
    }

    public async deleteSearchAsync(user: User, id: string): Promise<Result<void>>
    {
        const found = await this._searches.getAsync(id);
        if (!found.ok || found.data.userId !== user.id)
        {
            return failure(AppError.NotFound);
        }
        return this._searches.deleteAsync(id);
    }

    public async partnerInquiryAsync(input: Omit<PartnerInquiry, 'id' | 'createdAt'>): Promise<Result<PartnerInquiry>>
    {
        if (!input.gu.trim() || input.contact.trim().length < 5 || input.rooms < 1)
        {
            return failure(AppError.InvalidInput);
        }
        const saved = await this._partners.saveAsync({ ...input, id: this._ids.next('pt'), createdAt: this._clock.now().toISOString() });
        if (saved.ok)
        {
            await this._notifier.sendAsync({ to: 'owner', urgent: false, text: `집 빌려주기 문의 · ${input.gu} · 방 ${input.rooms}` });
        }
        return saved;
    }

    public async partnersAsync(): Promise<Result<PartnerInquiry[]>>
    {
        return this._partners.getAllAsync();
    }
}
