// 공지사항 Model — REQ_046 ~ 048, POL_NOTICE
export type NoticeCategory = 'service' | 'house' | 'event';
export const NOTICE_CATEGORIES: readonly NoticeCategory[] = ['service', 'house', 'event'];

export interface Notice
{
    readonly id: string;
    readonly category: NoticeCategory;
    readonly titleKo: string;
    readonly bodyKo: string;
    readonly titleEn: string;          // 비어 있으면 영어 화면에도 한국어로 보여 준다
    readonly bodyEn: string;
    readonly pinned: boolean;          // 📌 맨 위 고정 · 홈 화면 띠
    readonly published: boolean;       // false = 내림 (지우지 않고 기록은 남김)
    readonly example: boolean;         // Mock 예시
    readonly createdAt: string;
    readonly updatedAt: string;
}
