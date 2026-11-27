// DTO: data/notices.json 그대로 (snake_case, 전부 선택값)
export interface ExampleNoticeDto
{
    readonly id?: string;
    readonly category?: string;
    readonly pinned?: boolean;
    readonly days_ago?: number;
    readonly title_ko?: string;
    readonly body_ko?: string;
    readonly title_en?: string;
    readonly body_en?: string;
}
