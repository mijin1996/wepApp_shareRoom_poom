// 조립(DI): 구현체를 여기서만 new 하고, 각 Service 에는 생성자로 넣어 준다 (개념편 7.2 DIP)
// Real 모드가 생기면 이 파일에서 Memory → D1 / Mock → 실제 업체로 바꿔 끼운다.
import { MemoryNotifier, MockIdentityVerifier, MockPaymentGateway, RandomIdGenerator, SystemClock, type IClock, type IIdGenerator, type INotifier, type IPaymentGateway } from './adapters/adapters';
import { MemoryRecordDataSource, type IRecord } from './dataSources/recordDataSource';
import { JsonSeedDataSource } from './dataSources/seedDataSource';
import { HousingRepository } from './repositories/housingRepository';
import { RecordRepository } from './repositories/recordRepository';
import { ApplicationService } from './services/applicationService';
import { AuthService } from './services/authService';
import { ContractService } from './services/contractService';
import { ReportService } from './services/reportService';
import { RoomService } from './services/roomService';
import { SavedService } from './services/savedService';
import { SearchService } from './services/searchService';

export interface ContainerOptions
{
    readonly clock?: IClock;
    readonly ids?: IIdGenerator;
    readonly notifier?: INotifier;
    readonly gateway?: IPaymentGateway;
}

function memoryRepo<T extends IRecord>(): RecordRepository<T>
{
    return new RecordRepository<T>(new MemoryRecordDataSource<T>());
}

export function createContainer(options: ContainerOptions = {})
{
    const clock = options.clock ?? new SystemClock();
    const ids = options.ids ?? new RandomIdGenerator();
    const notifier = options.notifier ?? new MemoryNotifier();
    const gateway = options.gateway ?? new MockPaymentGateway();

    const housing = new HousingRepository(new JsonSeedDataSource());
    const apps = memoryRepo<import('./models/people').Application>();

    return {
        notifier,
        rooms: new RoomService(housing, clock),
        search: new SearchService(housing, memoryRepo()),
        auth: new AuthService(memoryRepo(), memoryRepo(), new MockIdentityVerifier(), ids, clock),
        applications: new ApplicationService(apps, housing, notifier, ids, clock),
        contracts: new ContractService(apps, memoryRepo(), memoryRepo(), housing, gateway, notifier, ids, clock),
        reports: new ReportService(memoryRepo(), notifier, ids, clock),
        saved: new SavedService(memoryRepo(), memoryRepo(), memoryRepo(), notifier, ids, clock),
    };
}

export type Container = ReturnType<typeof createContainer>;
