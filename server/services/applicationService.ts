// ApplicationService: 신청 · 서류 · 승인 규칙 — REQ_004 · 012 · 024, POL_HOUSE · POL_ROOM
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { Lang } from '../models/housing';
import type { Application, Child, DocType, User } from '../models/people';
import type { IHousingRepository } from '../repositories/housingRepository';
import type { IRecordRepository } from '../repositories/recordRepository';
import { checkFit, householdArea } from '../rules/housingStandard';
import type { IClock, IIdGenerator, INotifier } from '../adapters/adapters';

const MAX_MEMO = 200;
const DOC_TYPES: readonly DocType[] = ['resident_reg', 'single_parent', 'alien_reg'];
const ACTIVE: readonly Application['status'][] = ['received', 'approved', 'on_hold'];

export interface ApplyInput
{
    readonly roomId: string;
    readonly moveInDate: string;
    readonly months: number;
    readonly children: readonly Child[];
    readonly contactTime: string;
    readonly consultLang: Lang;
    readonly memo: string;
    readonly docType: DocType | undefined;      // 신청 때 바로 올리면 (POL_HOUSE_02)
}

export type Decision = 'approve' | 'hold' | 'reject';

export class ApplicationService
{
    private readonly _apps: IRecordRepository<Application>;
    private readonly _housing: IHousingRepository;
    private readonly _notifier: INotifier;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;

    public constructor(apps: IRecordRepository<Application>, housing: IHousingRepository, notifier: INotifier, ids: IIdGenerator, clock: IClock)
    {
        this._apps = apps;
        this._housing = housing;
        this._notifier = notifier;
        this._ids = ids;
        this._clock = clock;
    }

    public async applyAsync(user: User, input: ApplyInput): Promise<Result<Application>>
    {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.moveInDate) || input.months < 1 || input.months > 24)
        {
            return failure(AppError.InvalidInput);
        }
        if (input.docType && !DOC_TYPES.includes(input.docType))
        {
            return failure(AppError.InvalidInput);
        }

        // 진행 중인 신청은 하나만 (APPLY_409)
        const mine = await this._apps.findWhereAsync((a) => a.userId === user.id && ACTIVE.includes(a.status));
        if (!mine.ok)
        {
            return mine;
        }
        if (mine.data.length > 0)
        {
            return failure(AppError.ApplicationInProgress);
        }

        const room = await this._housing.getRoomAsync(input.roomId);
        if (!room.ok)
        {
            return room;
        }
        if (room.data.status !== 'vacant')
        {
            return failure(AppError.RoomNotVacant);
        }
        const house = await this._housing.getHouseAsync(room.data.houseId);
        if (!house.ok)
        {
            return house;
        }
        // 엄마 하우스는 엄마, 아빠 하우스는 아빠 (POL_SAFETY_01)
        const expectedGender = house.data.type === 'mom' ? 'f' : 'm';
        if (user.gender !== expectedGender)
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
        const app: Application = {
            id: this._ids.next('app'),
            userId: user.id,
            roomId: room.data.id,
            moveInDate: input.moveInDate < room.data.availableFrom ? room.data.availableFrom : input.moveInDate,
            months: input.months,
            children: input.children,
            contactTime: input.contactTime.slice(0, 40),
            consultLang: input.consultLang,
            memo: input.memo.slice(0, MAX_MEMO),
            status: 'received',
            document: input.docType ? { docType: input.docType, uploadedAt: now, checked: false } : undefined,
            createdAt: now,
        };
        const saved = await this._apps.saveAsync(app);
        if (saved.ok)
        {
            await this._notifier.sendAsync({ to: 'operator', urgent: false, text: `새 신청 ${app.id} · ${house.data.nameKo} · 2시간 안에 전화 (${input.consultLang === 'en' ? '영어 상담' : '한국어'})` });
        }
        return saved;
    }

    public async uploadDocumentAsync(user: User, appId: string, docType: DocType): Promise<Result<Application>>
    {
        if (!DOC_TYPES.includes(docType))
        {
            return failure(AppError.InvalidInput);
        }
        const app = await this.getMineAsync(user, appId);
        if (!app.ok)
        {
            return app;
        }
        const updated: Application = { ...app.data, document: { docType, uploadedAt: this._clock.now().toISOString(), checked: false } };
        return this._apps.saveAsync(updated);
    }

    public async getMineAsync(user: User, appId: string): Promise<Result<Application>>
    {
        const app = await this._apps.getAsync(appId);
        if (!app.ok)
        {
            return app;
        }
        return app.data.userId === user.id ? app : failure(AppError.NotFound);
    }

    public async listMineAsync(user: User): Promise<Result<Application[]>>
    {
        const mine = await this._apps.findWhereAsync((a) => a.userId === user.id);
        return mine.ok ? success([...mine.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) : mine;
    }

    // ---------- 운영 콘솔 ----------
    public async listAllAsync(): Promise<Result<Application[]>>
    {
        const all = await this._apps.getAllAsync();
        return all.ok ? success([...all.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) : all;
    }

    public async decideAsync(appId: string, decision: Decision): Promise<Result<Application>>
    {
        const app = await this._apps.getAsync(appId);
        if (!app.ok)
        {
            return app;
        }
        const status = decision === 'approve' ? 'approved' : decision === 'hold' ? 'on_hold' : 'rejected';
        if (decision === 'approve')
        {
            // 승인 → 72시간 잡아 두기 (held)
            const held = await this._housing.setRoomStatusAsync(app.data.roomId, 'held');
            if (!held.ok)
            {
                return held;
            }
        }
        const saved = await this._apps.saveAsync({ ...app.data, status });
        if (saved.ok)
        {
            await this._notifier.sendAsync({ to: 'user:' + app.data.userId, urgent: false, text: `신청 결과: ${status}` });
        }
        return saved;
    }

    public async confirmDocumentAsync(appId: string): Promise<Result<Application>>
    {
        const app = await this._apps.getAsync(appId);
        if (!app.ok)
        {
            return app;
        }
        if (!app.data.document)
        {
            return failure(AppError.DocumentRequired);
        }
        return this._apps.saveAsync({ ...app.data, document: { ...app.data.document, checked: true } });
    }
}
