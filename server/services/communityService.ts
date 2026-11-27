// CommunityService: 묻고 답하기 — REQ_041 ~ 044, POL_COMMUNITY_01 ~ 07
// 읽기는 누구나, 쓰기는 본인인증한 회원만. 화면에는 실명 대신 "엄마 · 아빠 + 4글자"만 보인다.
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { ExampleQuestionDto } from '../dtos/communityDto';
import { toExampleQuestion } from '../mappers/communityMapper';
import { TOPICS, type Alias, type Answer, type Question, type QuestionSummary, type Topic } from '../models/community';
import type { Lang } from '../models/housing';
import type { User } from '../models/people';
import type { IRecordRepository } from '../repositories/recordRepository';
import { matchesQuery } from '../rules/hangul';
import { maskPrivate } from '../rules/privacyMask';
import type { IClock, IIdGenerator, INotifier } from '../adapters/adapters';

const TITLE_MIN = 5;
const TITLE_MAX = 80;
const BODY_MIN = 5;
const ANSWER_MIN = 2;
const TEXT_MAX = 1000;
export const QUESTIONS_PER_HOUR = 5;
const ANSWERS_PER_HOUR = 20;
export const HIDE_AFTER_FLAGS = 3;
const HOUR_MS = 60 * 60 * 1000;
const TEAM_ALIAS: Alias = { role: 'team', tag: '' };

export interface AskInput
{
    readonly topic: Topic;
    readonly title: string;
    readonly body: string;
    readonly lang: Lang;
}

export interface AnswerView
{
    readonly id: string;
    readonly alias: Alias;
    readonly body: string;
    readonly official: boolean;
    readonly mine: boolean;
    readonly createdAt: string;
}

export interface QuestionView
{
    readonly id: string;
    readonly alias: Alias;
    readonly topic: Topic;
    readonly title: string;
    readonly body: string;
    readonly lang: Lang;
    readonly example: boolean;
    readonly mine: boolean;
    readonly solvedAnswerId: string | undefined;
    readonly answers: readonly AnswerView[];
    readonly createdAt: string;
}

// 같은 사람 글끼리만 알아볼 수 있는 짧은 표시 (실명 · 전화번호와 연결되지 않음)
export function aliasOf(user: User): Alias
{
    let hash = 7;
    for (const ch of user.id)
    {
        hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    }
    return { role: user.gender === 'm' ? 'dad' : 'mom', tag: hash.toString(36).toUpperCase().padStart(4, '0').slice(-4) };
}

type Flaggable = { readonly flaggedBy: readonly string[]; readonly hidden: boolean };

export class CommunityService
{
    private readonly _questions: IRecordRepository<Question>;
    private readonly _examples: readonly ExampleQuestionDto[];
    private readonly _notifier: INotifier;
    private readonly _ids: IIdGenerator;
    private readonly _clock: IClock;
    private _seeded = false;

    public constructor(questions: IRecordRepository<Question>, examples: readonly ExampleQuestionDto[], notifier: INotifier, ids: IIdGenerator, clock: IClock)
    {
        this._questions = questions;
        this._examples = examples;
        this._notifier = notifier;
        this._ids = ids;
        this._clock = clock;
    }

    // Mock 모드: 처음 열 때 예시 글을 넣어 빈 화면이 되지 않게 (화면에 "예시" 표시)
    private async _ensureSeededAsync(): Promise<void>
    {
        if (this._seeded)
        {
            return;
        }
        this._seeded = true;
        const now = this._clock.now();
        for (const [index, dto] of this._examples.entries())
        {
            await this._questions.saveAsync(toExampleQuestion(dto, index, now));
        }
    }

    private async _recentCountAsync(user: User, kind: 'question' | 'answer'): Promise<Result<number>>
    {
        const since = this._clock.now().getTime() - HOUR_MS;
        const all = await this._questions.getAllAsync();
        if (!all.ok)
        {
            return all;
        }
        const recent = (iso: string) => Date.parse(iso) >= since;
        const count = kind === 'question'
            ? all.data.filter((q) => q.userId === user.id && recent(q.createdAt)).length
            : all.data.flatMap((q) => q.answers).filter((a) => a.userId === user.id && recent(a.createdAt)).length;
        return success(count);
    }

    private async _visibleAsync(questionId: string): Promise<Result<Question>>
    {
        await this._ensureSeededAsync();
        const found = await this._questions.getAsync(questionId);
        return found.ok && !found.data.hidden ? found : failure(AppError.NotFound);
    }

    public async listAsync(filter: { topic?: Topic; q?: string }): Promise<Result<QuestionSummary[]>>
    {
        await this._ensureSeededAsync();
        const q = (filter.q ?? '').trim();
        const found = await this._questions.findWhereAsync((item) =>
            !item.hidden
            && (!filter.topic || item.topic === filter.topic)
            && (!q || matchesQuery(item.title, q) || item.body.includes(q)));
        if (!found.ok)
        {
            return found;
        }
        const list = found.data
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((item): QuestionSummary =>
            {
                const visible = item.answers.filter((a) => !a.hidden);
                return {
                    id: item.id,
                    alias: item.alias,
                    topic: item.topic,
                    title: item.title,
                    lang: item.lang,
                    answerCount: visible.length,
                    hasOfficial: visible.some((a) => a.official),
                    solved: item.solvedAnswerId !== undefined,
                    example: item.example,
                    createdAt: item.createdAt,
                };
            });
        return success(list);
    }

    public async getAsync(id: string, viewer: User | undefined): Promise<Result<QuestionView>>
    {
        const found = await this._visibleAsync(id);
        if (!found.ok)
        {
            return found;
        }
        const item = found.data;
        const isMine = (userId: string | undefined) => viewer !== undefined && userId === viewer.id;
        return success({
            id: item.id,
            alias: item.alias,
            topic: item.topic,
            title: item.title,
            body: item.body,
            lang: item.lang,
            example: item.example,
            mine: isMine(item.userId),
            solvedAnswerId: item.solvedAnswerId,
            answers: item.answers
                .filter((a) => !a.hidden)
                .sort((a, b) => Number(b.official) - Number(a.official) || a.createdAt.localeCompare(b.createdAt))
                .map((a) => ({ id: a.id, alias: a.alias, body: a.body, official: a.official, mine: isMine(a.userId), createdAt: a.createdAt })),
            createdAt: item.createdAt,
        });
    }

    public async askAsync(user: User, input: AskInput): Promise<Result<Question>>
    {
        const title = maskPrivate(input.title.trim());
        const body = maskPrivate(input.body.trim());
        if (!TOPICS.includes(input.topic) || title.length < TITLE_MIN || title.length > TITLE_MAX || body.length < BODY_MIN || body.length > TEXT_MAX)
        {
            return failure(AppError.InvalidInput);
        }
        const recent = await this._recentCountAsync(user, 'question');
        if (!recent.ok)
        {
            return recent;
        }
        if (recent.data >= QUESTIONS_PER_HOUR)
        {
            return failure(AppError.TooManyPosts);
        }
        const question: Question = {
            id: this._ids.next('q'),
            userId: user.id,
            alias: aliasOf(user),
            topic: input.topic,
            title,
            body,
            lang: input.lang,
            answers: [],
            solvedAnswerId: undefined,
            hidden: false,
            flaggedBy: [],
            example: false,
            createdAt: this._clock.now().toISOString(),
        };
        const saved = await this._questions.saveAsync(question);
        if (saved.ok)
        {
            await this._notifier.sendAsync({ to: 'operator', urgent: false, text: `새 질문 ${question.id} · ${title}` });
        }
        return saved;
    }

    private async _addAnswerAsync(questionId: string, answer: Answer): Promise<Result<Answer>>
    {
        const found = await this._visibleAsync(questionId);
        if (!found.ok)
        {
            return found;
        }
        const saved = await this._questions.saveAsync({ ...found.data, answers: [...found.data.answers, answer] });
        return saved.ok ? success(answer) : saved;
    }

    public async answerAsync(user: User, questionId: string, text: string): Promise<Result<Answer>>
    {
        const body = maskPrivate(text.trim());
        if (body.length < ANSWER_MIN || body.length > TEXT_MAX)
        {
            return failure(AppError.InvalidInput);
        }
        const recent = await this._recentCountAsync(user, 'answer');
        if (!recent.ok)
        {
            return recent;
        }
        if (recent.data >= ANSWERS_PER_HOUR)
        {
            return failure(AppError.TooManyPosts);
        }
        return this._addAnswerAsync(questionId, {
            id: this._ids.next('a'),
            userId: user.id,
            alias: aliasOf(user),
            body,
            official: false,
            hidden: false,
            flaggedBy: [],
            createdAt: this._clock.now().toISOString(),
        });
    }

    // 질문한 사람만 "도움 됐어요"로 해결 표시
    public async solveAsync(user: User, questionId: string, answerId: string): Promise<Result<void>>
    {
        const found = await this._visibleAsync(questionId);
        if (!found.ok)
        {
            return found;
        }
        if (found.data.userId !== user.id)
        {
            return failure(AppError.Forbidden);
        }
        if (!found.data.answers.some((a) => a.id === answerId && !a.hidden))
        {
            return failure(AppError.NotFound);
        }
        const saved = await this._questions.saveAsync({ ...found.data, solvedAnswerId: answerId });
        return saved.ok ? success(undefined) : saved;
    }

    // 서로 다른 3명이 신고하면 자동으로 숨기고 운영팀이 다시 본다 (POL_COMMUNITY_05)
    public async flagAsync(user: User, questionId: string, answerId: string | undefined): Promise<Result<{ hidden: boolean }>>
    {
        const found = await this._visibleAsync(questionId);
        if (!found.ok)
        {
            return found;
        }
        const q = found.data;
        const addFlag = <T extends Flaggable>(target: T): T =>
        {
            const flaggedBy = target.flaggedBy.includes(user.id) ? target.flaggedBy : [...target.flaggedBy, user.id];
            return { ...target, flaggedBy, hidden: target.hidden || flaggedBy.length >= HIDE_AFTER_FLAGS };
        };
        let updated: Question;
        let hidden: boolean;
        if (answerId)
        {
            const answer = q.answers.find((a) => a.id === answerId && !a.hidden);
            if (!answer || answer.official)
            {
                return failure(AppError.NotFound);
            }
            const flagged = addFlag(answer);
            hidden = flagged.hidden;
            updated = { ...q, answers: q.answers.map((a) => (a.id === answerId ? flagged : a)) };
        }
        else
        {
            updated = addFlag(q);
            hidden = updated.hidden;
        }
        const saved = await this._questions.saveAsync(updated);
        if (!saved.ok)
        {
            return saved;
        }
        if (hidden)
        {
            await this._notifier.sendAsync({ to: 'operator', urgent: false, text: `커뮤니티 신고 ${HIDE_AFTER_FLAGS}건 → 자동 숨김 ${questionId}${answerId ? ' / ' + answerId : ''}` });
        }
        return success({ hidden });
    }

    // ---------- 운영 콘솔 ----------
    public async listAllAsync(): Promise<Result<Question[]>>
    {
        await this._ensureSeededAsync();
        const all = await this._questions.getAllAsync();
        return all.ok ? success(all.data.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) : all;
    }

    public async officialAnswerAsync(questionId: string, text: string): Promise<Result<Answer>>
    {
        const body = text.trim();
        if (body.length < ANSWER_MIN || body.length > TEXT_MAX)
        {
            return failure(AppError.InvalidInput);
        }
        return this._addAnswerAsync(questionId, {
            id: this._ids.next('a'),
            userId: undefined,
            alias: TEAM_ALIAS,
            body,
            official: true,
            hidden: false,
            flaggedBy: [],
            createdAt: this._clock.now().toISOString(),
        });
    }

    // 숨김 / 다시 보이기 (다시 보이면 신고 기록은 비운다)
    public async setHiddenAsync(questionId: string, answerId: string | undefined, hidden: boolean): Promise<Result<Question>>
    {
        await this._ensureSeededAsync();
        const found = await this._questions.getAsync(questionId);
        if (!found.ok)
        {
            return failure(AppError.NotFound);
        }
        const q = found.data;
        if (answerId && !q.answers.some((a) => a.id === answerId))
        {
            return failure(AppError.NotFound);
        }
        const reset = <T extends Flaggable>(target: T): T => ({ ...target, hidden, flaggedBy: hidden ? target.flaggedBy : [] });
        const updated: Question = answerId
            ? { ...q, answers: q.answers.map((a) => (a.id === answerId ? reset(a) : a)) }
            : reset(q);
        return this._questions.saveAsync(updated);
    }
}
