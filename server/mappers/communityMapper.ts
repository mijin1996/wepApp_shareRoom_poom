// Mapper: 예시 글 DTO → Question. 빈 값은 안전한 기본값으로
import type { ExampleQuestionDto } from '../dtos/communityDto';
import { TOPICS, type AliasRole, type Question, type Topic } from '../models/community';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXAMPLE_USER = 'example';
const ROLES: readonly AliasRole[] = ['mom', 'dad', 'team'];

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T
{
    return allowed.includes(value as T) ? (value as T) : fallback;
}

export function toExampleQuestion(dto: ExampleQuestionDto, index: number, now: Date): Question
{
    const id = dto.id || `q-ex-${index + 1}`;
    const createdAt = new Date(now.getTime() - Math.max(0, dto.days_ago ?? 0) * DAY_MS).toISOString();
    return {
        id,
        userId: EXAMPLE_USER,
        alias: { role: pick(dto.role, ROLES, 'mom'), tag: 'EX' + (index + 1) },
        topic: pick<Topic>(dto.topic, TOPICS, 'etc'),
        title: dto.title?.trim() || '—',
        body: dto.body?.trim() || '',
        lang: dto.lang === 'en' ? 'en' : 'ko',
        answers: (dto.answers ?? []).map((a, n) => ({
            id: `${id}-a${n + 1}`,
            userId: undefined,
            alias: { role: pick(a.role, ROLES, 'mom'), tag: a.role === 'team' ? '' : `EX${index + 1}${n + 1}` },
            body: a.body?.trim() || '',
            official: a.official === true && a.role === 'team',
            hidden: false,
            flaggedBy: [],
            createdAt,
        })),
        solvedAnswerId: undefined,
        hidden: false,
        flaggedBy: [],
        example: true,
        createdAt,
    };
}
