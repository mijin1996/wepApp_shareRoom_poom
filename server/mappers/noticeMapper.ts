// Mapper: 공지 예시 DTO → Notice. 빈 값은 안전한 기본값으로
import type { ExampleNoticeDto } from '../dtos/noticeDto';
import { NOTICE_CATEGORIES, type Notice, type NoticeCategory } from '../models/notice';

const DAY_MS = 24 * 60 * 60 * 1000;

export function toExampleNotice(dto: ExampleNoticeDto, index: number, now: Date): Notice
{
    const at = new Date(now.getTime() - Math.max(0, dto.days_ago ?? 0) * DAY_MS).toISOString();
    return {
        id: dto.id || `n-ex-${index + 1}`,
        category: NOTICE_CATEGORIES.includes(dto.category as NoticeCategory) ? (dto.category as NoticeCategory) : 'service',
        titleKo: dto.title_ko?.trim() || '—',
        bodyKo: dto.body_ko?.trim() || '',
        titleEn: dto.title_en?.trim() ?? '',
        bodyEn: dto.body_en?.trim() ?? '',
        pinned: dto.pinned === true,
        published: true,
        example: true,
        createdAt: at,
        updatedAt: at,
    };
}
