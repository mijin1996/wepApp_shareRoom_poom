// 조립(DI): 구현체를 여기서만 new 하고, 각 Service 에는 생성자로 넣어 준다 (개념편 7.2 DIP)
// Real 모드가 생기면 이 파일에서 Memory → D1 / Mock → 실제 업체로 바꿔 끼운다.
import { MemoryNotifier, MockIdentityVerifier, MockPaymentGateway, RandomIdGenerator, SystemClock, type IClock, type IIdGenerator, type INotifier, type IPaymentGateway } from './adapters/adapters';
import { MemoryRecordDataSource, type IRecord } from './dataSources/recordDataSource';
import { JsonSeedDataSource } from './dataSources/seedDataSource';
import { HousingRepository } from './repositories/housingRepository';
import { RecordRepository } from './repositories/recordRepository';
import adProductsJson from '../data/ad_products.json';
import communityJson from '../data/community.json';
import noticesJson from '../data/notices.json';
import perksJson from '../data/perks.json';
import type { ExamplePerkDto } from './dtos/adDto';
import type { ExampleNoticeDto } from './dtos/noticeDto';
import type { ExampleQuestionDto } from './dtos/communityDto';
import { toAdProduct } from './mappers/adMapper';
import type { AdProduct, Advertiser } from './models/advertising';
import type { User } from './models/people';
import { AdvertiserService } from './services/advertiserService';
import { AuthService } from './services/authService';
import { BillingService } from './services/billingService';
import { CommunityService } from './services/communityService';
import { InquiryService } from './services/inquiryService';
import { ListingService } from './services/listingService';
import { NoticeService } from './services/noticeService';
import { PerkService } from './services/perkService';
import { ProposalService } from './services/proposalService';
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
    readonly communityExamples?: readonly ExampleQuestionDto[];   // 테스트는 [] 로 빈 상태에서 시작
    readonly noticeExamples?: readonly ExampleNoticeDto[];
    readonly perkExamples?: readonly ExamplePerkDto[];
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
    const users = memoryRepo<User>();
    const advertisers = memoryRepo<Advertiser>();
    const products = adProductsJson.products.map(toAdProduct).filter((p): p is AdProduct => p !== null);
    const listings = new ListingService(memoryRepo(), advertisers, housing, notifier, ids, clock);
    const billing = new BillingService(products, memoryRepo(), advertisers, listings, gateway, ids, clock);

    return {
        notifier,
        rooms: new RoomService(housing, clock),
        search: new SearchService(housing, memoryRepo()),
        auth: new AuthService(users, memoryRepo(), new MockIdentityVerifier(), ids),
        inquiries: new InquiryService(memoryRepo(), memoryRepo(), users, housing, billing, notifier, ids, clock),
        advertisers: new AdvertiserService(advertisers, notifier, ids, clock),
        listings,
        billing,
        perks: new PerkService(memoryRepo(), memoryRepo(), options.perkExamples ?? perksJson.perks, notifier, ids, clock),
        proposals: new ProposalService(memoryRepo(), notifier, ids, clock),
        reports: new ReportService(memoryRepo(), notifier, ids, clock),
        saved: new SavedService(memoryRepo(), memoryRepo(), ids, clock),
        notices: new NoticeService(memoryRepo(), options.noticeExamples ?? noticesJson.notices, ids, clock),
        community: new CommunityService(memoryRepo(), options.communityExamples ?? communityJson.questions, notifier, ids, clock),
    };
}

export type Container = ReturnType<typeof createContainer>;
