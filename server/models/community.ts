// 커뮤니티 (묻고 답하기) Model — REQ_041 ~ 044, POL_COMMUNITY
import type { Lang } from './housing';

export type Topic = 'movein' | 'life' | 'kids' | 'support' | 'etc';
export const TOPICS: readonly Topic[] = ['movein', 'life', 'kids', 'support', 'etc'];

// 화면에는 실명 대신 "엄마 · 아빠 · 품 운영팀 + 짧은 표시"만 (POL_COMMUNITY_02)
export type AliasRole = 'mom' | 'dad' | 'team';

export interface Alias
{
    readonly role: AliasRole;
    readonly tag: string;             // 같은 사람 글끼리만 알아볼 수 있는 4글자
}

export interface Answer
{
    readonly id: string;
    readonly userId: string | undefined;  // 운영팀 답변은 없음
    readonly alias: Alias;
    readonly body: string;
    readonly official: boolean;
    readonly hidden: boolean;
    readonly flaggedBy: readonly string[];
    readonly createdAt: string;
}

export interface Question
{
    readonly id: string;
    readonly userId: string;
    readonly alias: Alias;
    readonly topic: Topic;
    readonly title: string;
    readonly body: string;
    readonly lang: Lang;
    readonly answers: readonly Answer[];
    readonly solvedAnswerId: string | undefined;
    readonly hidden: boolean;
    readonly flaggedBy: readonly string[];
    readonly example: boolean;            // 예시 글 (Mock 씨앗 데이터)
    readonly createdAt: string;
}

// 목록용 요약 (본문 · 답변 내용 · 사용자 아이디 없음)
export interface QuestionSummary
{
    readonly id: string;
    readonly alias: Alias;
    readonly topic: Topic;
    readonly title: string;
    readonly lang: Lang;
    readonly answerCount: number;
    readonly hasOfficial: boolean;
    readonly solved: boolean;
    readonly example: boolean;
    readonly createdAt: string;
}
