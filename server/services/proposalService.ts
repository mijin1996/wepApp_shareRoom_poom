// ProposalService: 문의 메뉴 — 광고 · 제휴 · 후원 · 기관 제안 받기 (POL_PROPOSAL)
// 로그인 없이 누구나 남길 수 있고, 운영 매니저가 연락해 계약을 맺는다
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import { PROPOSAL_KINDS, PROPOSAL_STATUSES, type Proposal, type ProposalKind, type ProposalStatus } from '../models/perk';
import { maskPrivate } from '../rules/privacyMask';
import type { IRecordRepository } from '../repositories/recordRepository';
import type { IClock, IIdGenerator, INotifier } from '../adapters/adapters';

const ORG_MAX = 60;
const NAME_MAX = 30;
const CONTACT_MIN = 5;
const CONTACT_MAX = 80;
const MESSAGE_MIN = 5;
const MESSAGE_MAX = 2000;

export interface ProposalInput
{
    readonly kind: ProposalKind;
    readonly org: string;
    readonly name: string;
    readonly contact: string;
    readonly message: string;
}

export class ProposalService
{
    private readonly _proposals: IRecordRepository<Proposal>;
    private readonly _notifier: INotifier;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;

    public constructor(proposals: IRecordRepository<Proposal>, notifier: INotifier, ids: IIdGenerator, clock: IClock)
    {
        this._proposals = proposals;
        this._notifier = notifier;
        this._ids = ids;
        this._clock = clock;
    }

    public async submitAsync(input: ProposalInput): Promise<Result<Proposal>>
    {
        const contact = input.contact.trim();
        const message = input.message.trim();
        if (!PROPOSAL_KINDS.includes(input.kind) || contact.length < CONTACT_MIN || contact.length > CONTACT_MAX
            || message.length < MESSAGE_MIN || message.length > MESSAGE_MAX || input.org.length > ORG_MAX || input.name.length > NAME_MAX)
        {
            return failure(AppError.InvalidInput);
        }
        const proposal: Proposal = {
            id: this._ids.next('prp'),
            kind: input.kind,
            org: input.org.trim(),
            name: input.name.trim(),
            contact,
            // 연락처는 연락처 칸에만. 본문에 섞인 주민번호 · 다른 연락처는 가림
            message: maskPrivate(message),
            status: 'new',
            createdAt: this._clock.now().toISOString(),
        };
        const saved = await this._proposals.saveAsync(proposal);
        if (saved.ok)
        {
            await this._notifier.sendAsync({ to: 'operator', urgent: false, text: `새 제안 문의 · ${proposal.kind} · ${proposal.org || proposal.name || '이름 없음'}` });
        }
        return saved;
    }

    // ---------- 운영 콘솔 ----------
    public async listAllAsync(): Promise<Result<Proposal[]>>
    {
        const all = await this._proposals.getAllAsync();
        if (!all.ok)
        {
            return all;
        }
        const order = (p: Proposal) => PROPOSAL_STATUSES.indexOf(p.status);
        return success([...all.data].sort((a, b) => order(a) - order(b) || b.createdAt.localeCompare(a.createdAt)));
    }

    public async setStatusAsync(id: string, status: ProposalStatus): Promise<Result<Proposal>>
    {
        if (!PROPOSAL_STATUSES.includes(status))
        {
            return failure(AppError.InvalidInput);
        }
        const proposal = await this._proposals.getAsync(id);
        return proposal.ok ? this._proposals.saveAsync({ ...proposal.data, status }) : proposal;
    }
}
