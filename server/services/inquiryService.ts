// InquiryService: 문의 전달 · 서류함 · 진행 표시 — POL_INQUIRY · POL_DOCBOX
// 품은 한부모 가족의 문의를 광고주에게 전달하고 진행을 기록할 뿐, 조건 협상 · 계약서 작성은 하지 않는다
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { Advertiser } from '../models/advertising';
import { isOpen, dayOf } from '../rules/dates';
import type { Lang } from '../models/housing';
import { AGE_BANDS, DOC_TYPES, URGENCIES, type Child, type DocType, type DocumentBox, type Inquiry, type InquiryStatus, type Urgency, type User } from '../models/people';
import type { IHousingRepository } from '../repositories/housingRepository';
import type { IRecordRepository } from '../repositories/recordRepository';
import { checkFit, householdArea } from '../rules/housingStandard';
import type { ILeadBilling } from './billingService';
import type { IClock, IIdGenerator, INotifier } from '../adapters/adapters';

const MAX_SITUATION = 1000;
const MAX_OPEN_INQUIRIES = 5;          // 동시에 진행할 수 있는 문의 수
const OPEN: readonly InquiryStatus[] = ['sent', 'contacted', 'viewing'];
// 광고주가 앞으로만 옮길 수 있는 순서
const FORWARD: readonly InquiryStatus[] = ['sent', 'contacted', 'viewing', 'contracted'];

export interface InquiryInput
{
    readonly roomId: string;
    readonly moveInDate: string;
    readonly months: number;
    readonly children: readonly Child[];
    readonly contactTime: string;
    readonly consultLang: Lang;
    readonly situation: string;
    readonly urgency: Urgency | undefined;
    readonly agree: boolean;             // 이름 · 연락처 · 내 상황을 광고주에게 보내는 데 동의
}

// 광고주에게 보이는 문의 (서류는 보낸 경우에만 종류 · 확인 여부)
export interface ReceivedInquiry
{
    readonly inquiry: Inquiry;
    readonly tenantName: string;
    readonly tenantPhone: string;
    readonly document: DocumentBox | undefined;
}

export interface InquiryStats
{
    readonly total: number;
    readonly byStatus: Readonly<Record<InquiryStatus, number>>;
    readonly byGu: readonly { gu: string; count: number }[];
    readonly urgentNow: number;
    readonly docsChecked: number;
}

export class InquiryService
{
    private readonly _inquiries: IRecordRepository<Inquiry>;
    private readonly _docs: IRecordRepository<DocumentBox>;
    private readonly _users: IRecordRepository<User>;
    private readonly _housing: IHousingRepository;
    private readonly _billing: ILeadBilling;
    private readonly _notifier: INotifier;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;

    public constructor(inquiries: IRecordRepository<Inquiry>, docs: IRecordRepository<DocumentBox>, users: IRecordRepository<User>,
        housing: IHousingRepository, billing: ILeadBilling, notifier: INotifier, ids: IIdGenerator, clock: IClock)
    {
        this._inquiries = inquiries;
        this._docs = docs;
        this._users = users;
        this._housing = housing;
        this._billing = billing;
        this._notifier = notifier;
        this._ids = ids;
        this._clock = clock;
    }

    public async sendAsync(user: User, input: InquiryInput): Promise<Result<Inquiry>>
    {
        if (!input.agree || !/^\d{4}-\d{2}-\d{2}$/.test(input.moveInDate) || input.months < 1 || input.months > 24)
        {
            return failure(AppError.InvalidInput);
        }
        // 자격은 오직 자녀 나이: 만 24세 이하 자녀가 1명 이상 (POL_HOUSE_01). 부모 나이는 보지 않는다
        if (input.children.length === 0 || input.children.some((child) => !AGE_BANDS.includes(child.ageBand)))
        {
            return failure(AppError.InvalidInput);
        }

        const mine = await this._inquiries.findWhereAsync((q) => q.userId === user.id && OPEN.includes(q.status));
        if (!mine.ok)
        {
            return mine;
        }
        // 같은 방에는 한 번만, 동시에 5곳까지
        if (mine.data.some((q) => q.roomId === input.roomId))
        {
            return failure(AppError.ApplicationInProgress);
        }
        if (mine.data.length >= MAX_OPEN_INQUIRIES)
        {
            return failure(AppError.TooManyInquiries);
        }

        const room = await this._housing.getRoomAsync(input.roomId);
        if (!room.ok)
        {
            return room;
        }
        const house = await this._housing.getHouseAsync(room.data.houseId);
        if (!house.ok)
        {
            return house;
        }
        if (room.data.status !== 'vacant' || !isOpen(house.data.listing.liveUntil, dayOf(this._clock.now())))
        {
            return failure(AppError.RoomNotVacant);
        }
        // 엄마 가족 방은 엄마, 아빠 가족 방은 아빠 (POL_SAFETY_01)
        if (user.gender !== (house.data.type === 'mom' ? 'f' : 'm'))
        {
            return failure(AppError.HouseTypeMismatch);
        }
        // 가족 수에 맞는 방만 (POL_ROOM_04 · 05)
        const fit = checkFit(room.data.bedrooms, householdArea(room.data.privateM2, house.data.sharedM2, house.data.households), input.children);
        if (fit === 'household_too_large')
        {
            return failure(AppError.HouseholdTooLarge);
        }
        if (fit === 'too_small')
        {
            return failure(AppError.RoomTooSmall);
        }

        const now = this._clock.now().toISOString();
        const inquiry: Inquiry = {
            id: this._ids.next('inq'),
            userId: user.id,
            roomId: room.data.id,
            houseId: house.data.id,
            advertiserId: house.data.listing.advertiserId,
            moveInDate: input.moveInDate < room.data.availableFrom ? room.data.availableFrom : input.moveInDate,
            months: input.months,
            children: input.children,
            contactTime: input.contactTime.slice(0, 40),
            consultLang: input.consultLang,
            situation: input.situation.trim().slice(0, MAX_SITUATION),
            urgency: input.urgency && URGENCIES.includes(input.urgency) ? input.urgency : undefined,
            status: 'sent',
            docShared: false,
            history: [{ status: 'sent', at: now, by: 'tenant' }],
            createdAt: now,
        };
        const saved = await this._inquiries.saveAsync(inquiry);
        if (!saved.ok)
        {
            return saved;
        }
        const lead = await this._billing.recordLeadAsync(inquiry.advertiserId, inquiry.roomId, inquiry.id);
        if (!lead.ok)
        {
            return lead;
        }
        await this._notifier.sendAsync({
            to: 'advertiser:' + inquiry.advertiserId,
            urgent: inquiry.urgency === 'now',
            text: `${inquiry.urgency === 'now' ? '🚨 당장 필요 · ' : ''}새 문의 · ${house.data.nameKo} · 연락 가능 ${inquiry.contactTime || '언제든'}`,
        });
        return saved;
    }

    public async listMineAsync(user: User): Promise<Result<Inquiry[]>>
    {
        const mine = await this._inquiries.findWhereAsync((q) => q.userId === user.id);
        return mine.ok ? success([...mine.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) : mine;
    }

    private async _mineAsync(user: User, id: string): Promise<Result<Inquiry>>
    {
        const inquiry = await this._inquiries.getAsync(id);
        if (!inquiry.ok)
        {
            return inquiry;
        }
        return inquiry.data.userId === user.id ? inquiry : failure(AppError.NotFound);
    }

    private _step(inquiry: Inquiry, status: InquiryStatus, by: 'tenant' | 'advertiser'): Inquiry
    {
        return { ...inquiry, status, history: [...inquiry.history, { status, at: this._clock.now().toISOString(), by }] };
    }

    // 문의한 사람: 서류함 서류를 이 광고주에게 보냄 (보낼 곳은 본인이 고름)
    public async shareDocumentAsync(user: User, id: string): Promise<Result<Inquiry>>
    {
        const inquiry = await this._mineAsync(user, id);
        if (!inquiry.ok)
        {
            return inquiry;
        }
        const doc = await this._docs.getAsync(user.id);
        if (!doc.ok)
        {
            return doc.error === AppError.NotFound ? failure(AppError.DocumentRequired) : doc;
        }
        if (inquiry.data.status === 'closed')
        {
            return failure(AppError.AlreadyDone);
        }
        const saved = await this._inquiries.saveAsync({ ...inquiry.data, docShared: true });
        if (saved.ok)
        {
            await this._notifier.sendAsync({ to: 'advertiser:' + inquiry.data.advertiserId, urgent: false, text: `문의 ${id} · 서류를 보냈어요` });
        }
        return saved;
    }

    // 문의한 사람: 계약했어요 / 그만둘래요
    public async tenantUpdateAsync(user: User, id: string, status: InquiryStatus): Promise<Result<Inquiry>>
    {
        const inquiry = await this._mineAsync(user, id);
        if (!inquiry.ok)
        {
            return inquiry;
        }
        if (status !== 'contracted' && status !== 'closed')
        {
            return failure(AppError.InvalidInput);
        }
        return this._moveAsync(inquiry.data, status, 'tenant');
    }

    // 광고주: 받은 문의 보기 (동의한 이름 · 연락처만)
    public async receivedAsync(advertiser: Advertiser): Promise<Result<ReceivedInquiry[]>>
    {
        const mine = await this._inquiries.findWhereAsync((q) => q.advertiserId === advertiser.id);
        if (!mine.ok)
        {
            return mine;
        }
        const rows: ReceivedInquiry[] = [];
        for (const inquiry of [...mine.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
        {
            const user = await this._users.getAsync(inquiry.userId);
            const doc = inquiry.docShared ? await this._docs.getAsync(inquiry.userId) : undefined;
            rows.push({
                inquiry,
                tenantName: user.ok ? user.data.name : '',
                tenantPhone: user.ok ? user.data.phone : '',
                document: doc?.ok ? doc.data : undefined,
            });
        }
        return success(rows);
    }

    // 광고주: 진행 표시 옮기기. 계약함은 서류를 받은 뒤에만 (POL_HOUSE_02 — 서류는 언제나 입주 전)
    public async advertiserUpdateAsync(advertiser: Advertiser, id: string, status: InquiryStatus): Promise<Result<Inquiry>>
    {
        const inquiry = await this._inquiries.getAsync(id);
        if (!inquiry.ok)
        {
            return inquiry;
        }
        if (inquiry.data.advertiserId !== advertiser.id)
        {
            return failure(AppError.NotFound);
        }
        return this._moveAsync(inquiry.data, status, 'advertiser');
    }

    private async _moveAsync(inquiry: Inquiry, status: InquiryStatus, by: 'tenant' | 'advertiser'): Promise<Result<Inquiry>>
    {
        if (inquiry.status === 'closed' || inquiry.status === 'contracted')
        {
            return failure(AppError.AlreadyDone);
        }
        if (status !== 'closed' && FORWARD.indexOf(status) <= FORWARD.indexOf(inquiry.status))
        {
            return failure(AppError.InvalidInput);
        }
        if (status === 'contracted' && !inquiry.docShared)
        {
            return failure(AppError.DocumentRequired);
        }
        const saved = await this._inquiries.saveAsync(this._step(inquiry, status, by));
        if (saved.ok)
        {
            const to = by === 'advertiser' ? 'user:' + inquiry.userId : 'advertiser:' + inquiry.advertiserId;
            await this._notifier.sendAsync({ to, urgent: false, text: `문의 ${inquiry.id} · ${status}` });
        }
        return saved;
    }

    // ---------- 서류함 ----------
    public async uploadDocumentAsync(user: User, docType: DocType): Promise<Result<DocumentBox>>
    {
        if (!DOC_TYPES.includes(docType))
        {
            return failure(AppError.InvalidInput);
        }
        // 새로 올리면 다시 확인 받아야 함
        return this._docs.saveAsync({ id: user.id, docType, uploadedAt: this._clock.now().toISOString(), checked: false });
    }

    public async myDocumentAsync(user: User): Promise<Result<DocumentBox | undefined>>
    {
        const doc = await this._docs.getAsync(user.id);
        if (!doc.ok)
        {
            return doc.error === AppError.NotFound ? success(undefined) : doc;
        }
        return doc;
    }

    // ---------- 운영 콘솔 ----------
    public async listAllAsync(): Promise<Result<Inquiry[]>>
    {
        const all = await this._inquiries.getAllAsync();
        return all.ok ? success([...all.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) : all;
    }

    public async listDocumentsAsync(): Promise<Result<DocumentBox[]>>
    {
        const all = await this._docs.getAllAsync();
        return all.ok ? success([...all.data].sort((a, b) => Number(a.checked) - Number(b.checked) || b.uploadedAt.localeCompare(a.uploadedAt))) : all;
    }

    public async confirmDocumentAsync(userId: string): Promise<Result<DocumentBox>>
    {
        const doc = await this._docs.getAsync(userId);
        if (!doc.ok)
        {
            return doc.error === AppError.NotFound ? failure(AppError.DocumentRequired) : doc;
        }
        return this._docs.saveAsync({ ...doc.data, checked: true });
    }

    // 기관 연계 보고용 통계 (개인 정보 없이 숫자만)
    public async statsAsync(): Promise<Result<InquiryStats>>
    {
        const [all, docs, houses] = await Promise.all([this._inquiries.getAllAsync(), this._docs.getAllAsync(), this._housing.getHousesAsync()]);
        if (!all.ok)
        {
            return all;
        }
        if (!docs.ok)
        {
            return docs;
        }
        if (!houses.ok)
        {
            return houses;
        }
        const guOf = new Map(houses.data.map((h) => [h.id, h.gu]));
        const byStatus = { sent: 0, contacted: 0, viewing: 0, contracted: 0, closed: 0 } as Record<InquiryStatus, number>;
        const byGu = new Map<string, number>();
        for (const q of all.data)
        {
            byStatus[q.status] += 1;
            const gu = guOf.get(q.houseId) ?? '';
            byGu.set(gu, (byGu.get(gu) ?? 0) + 1);
        }
        return success({
            total: all.data.length,
            byStatus,
            byGu: [...byGu.entries()].map(([gu, count]) => ({ gu, count })).sort((a, b) => b.count - a.count),
            urgentNow: all.data.filter((q) => q.urgency === 'now').length,
            docsChecked: docs.data.filter((d) => d.checked).length,
        });
    }
}
