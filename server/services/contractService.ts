// ContractService: 계약 · 결제 · 입주 안내 — REQ_006 · 007 · 009, POL_HOUSE_02 · POL_PRIVACY_03
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { Application, Contract, Payment, PayMethod, User } from '../models/people';
import type { IHousingRepository } from '../repositories/housingRepository';
import type { IRecordRepository } from '../repositories/recordRepository';
import type { IClock, IIdGenerator, INotifier, IPaymentGateway } from '../adapters/adapters';

const PAY_METHODS: readonly PayMethod[] = ['card', 'transfer', 'easy'];

export interface MoveInInfo
{
    readonly houseNameKo: string;
    readonly houseNameEn: string;
    readonly address: string;
    readonly entryInfoKo: string;
    readonly entryInfoEn: string;
    readonly moveInDate: string;
    readonly rulesKo: readonly string[];
    readonly rulesEn: readonly string[];
}

export class ContractService
{
    private readonly _apps: IRecordRepository<Application>;
    private readonly _contracts: IRecordRepository<Contract>;
    private readonly _payments: IRecordRepository<Payment>;
    private readonly _housing: IHousingRepository;
    private readonly _gateway: IPaymentGateway;
    private readonly _notifier: INotifier;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;

    public constructor(apps: IRecordRepository<Application>, contracts: IRecordRepository<Contract>, payments: IRecordRepository<Payment>,
        housing: IHousingRepository, gateway: IPaymentGateway, notifier: INotifier, ids: IIdGenerator, clock: IClock)
    {
        this._apps = apps;
        this._contracts = contracts;
        this._payments = payments;
        this._housing = housing;
        this._gateway = gateway;
        this._notifier = notifier;
        this._ids = ids;
        this._clock = clock;
    }

    // 서명: 승인 + 서류 확인이 끝나야 함 (DOC_428 · CONTRACT_403)
    public async signAsync(user: User, appId: string, signature: string): Promise<Result<Contract>>
    {
        const app = await this._apps.getAsync(appId);
        if (!app.ok || app.data.userId !== user.id)
        {
            return failure(AppError.NotFound);
        }
        if (app.data.status !== 'approved')
        {
            return failure(AppError.NotApproved);
        }
        if (!app.data.document || !app.data.document.checked)
        {
            return failure(AppError.DocumentRequired);
        }
        if (signature.trim().length < 2)
        {
            return failure(AppError.InvalidInput);
        }
        const existing = await this._contracts.findWhereAsync((c) => c.applicationId === appId);
        if (existing.ok && existing.data.length > 0)
        {
            return success(existing.data[0]);
        }
        const room = await this._housing.getRoomAsync(app.data.roomId);
        if (!room.ok)
        {
            return room;
        }
        const contract: Contract = {
            id: this._ids.next('ct'),
            applicationId: appId,
            userId: user.id,
            roomId: room.data.id,
            startDate: app.data.moveInDate,
            months: app.data.months,
            deposit: room.data.deposit,
            rent: room.data.rent,
            fee: room.data.fee,
            signedAt: this._clock.now().toISOString(),
            paid: false,
        };
        return this._contracts.saveAsync(contract);
    }

    public async payAsync(user: User, contractId: string, method: PayMethod): Promise<Result<Payment>>
    {
        if (!PAY_METHODS.includes(method))
        {
            return failure(AppError.InvalidInput);
        }
        const contract = await this._contracts.getAsync(contractId);
        if (!contract.ok || contract.data.userId !== user.id)
        {
            return failure(AppError.NotFound);
        }
        if (contract.data.paid)
        {
            return failure(AppError.AlreadyDone);
        }
        const amount = contract.data.deposit + contract.data.rent + contract.data.fee;
        const charge = await this._gateway.chargeAsync(amount, method, contract.data.id);
        if (!charge.approved)
        {
            return failure(AppError.PaymentFailed);
        }
        const payment: Payment = { id: this._ids.next('pay'), contractId, amount, method, paidAt: this._clock.now().toISOString() };
        const saved = await this._payments.saveAsync(payment);
        if (!saved.ok)
        {
            return saved;
        }
        await this._contracts.saveAsync({ ...contract.data, paid: true });
        await this._housing.setRoomStatusAsync(contract.data.roomId, 'occupied');
        await this._notifier.sendAsync({ to: 'operator', urgent: false, text: `결제 완료 ${contract.data.id} · 입주 준비` });
        return saved;
    }

    public async listMineAsync(user: User): Promise<Result<Contract[]>>
    {
        return this._contracts.findWhereAsync((c) => c.userId === user.id);
    }

    // 입주 안내: 결제가 끝나야 주소를 보여 준다 (POL_PRIVACY_03)
    public async moveInAsync(user: User): Promise<Result<MoveInInfo>>
    {
        const mine = await this._contracts.findWhereAsync((c) => c.userId === user.id && c.paid);
        if (!mine.ok)
        {
            return mine;
        }
        const contract = mine.data[0];
        if (!contract)
        {
            return failure(AppError.NotPaid);
        }
        const room = await this._housing.getRoomAsync(contract.roomId);
        if (!room.ok)
        {
            return room;
        }
        const house = await this._housing.getHouseAsync(room.data.houseId);
        if (!house.ok)
        {
            return house;
        }
        return success({
            houseNameKo: house.data.nameKo,
            houseNameEn: house.data.nameEn,
            address: house.data.address,
            entryInfoKo: house.data.entryInfoKo,
            entryInfoEn: house.data.entryInfoEn,
            moveInDate: contract.startDate,
            rulesKo: house.data.rulesKo,
            rulesEn: house.data.rulesEn,
        });
    }
}
