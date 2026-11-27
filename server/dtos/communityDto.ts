// DTO: data/community.json 그대로 (snake_case, 전부 선택값)
export interface ExampleAnswerDto
{
    readonly role?: string;
    readonly official?: boolean;
    readonly body?: string;
}

export interface ExampleQuestionDto
{
    readonly id?: string;
    readonly topic?: string;
    readonly role?: string;
    readonly lang?: string;
    readonly days_ago?: number;
    readonly title?: string;
    readonly body?: string;
    readonly answers?: readonly ExampleAnswerDto[];
}
