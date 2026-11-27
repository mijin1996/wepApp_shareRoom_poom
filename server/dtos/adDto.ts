// DTO: data/ad_products.json · data/perks.json 그대로 (snake_case, 전부 선택값)
export interface AdProductDto
{
    readonly id?: string;
    readonly for?: string;
    readonly price?: number;
    readonly days?: number;
    readonly name_ko?: string;
    readonly name_en?: string;
    readonly desc_ko?: string;
    readonly desc_en?: string;
}

export interface ExamplePerkDto
{
    readonly id?: string;
    readonly kind?: string;
    readonly action?: string;
    readonly url?: string;
    readonly provider_ko?: string;
    readonly provider_en?: string;
    readonly title_ko?: string;
    readonly title_en?: string;
    readonly desc_ko?: string;
    readonly desc_en?: string;
}
