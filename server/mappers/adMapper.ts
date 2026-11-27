// Mapper: 광고 상품 · 제휴 혜택 예시 DTO → Model. 빈 값 · 이상한 값은 안전한 기본값으로
import type { AdProductDto, ExamplePerkDto } from '../dtos/adDto';
import { PRODUCT_IDS, type AdProduct, type ProductFor, type ProductId } from '../models/advertising';
import { PERK_ACTIONS, PERK_KINDS, type Perk, type PerkAction, type PerkKind } from '../models/perk';

const FOR_KINDS: readonly ProductFor[] = ['agent', 'owner', 'both'];

function count(value: number | undefined): number
{
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

// 알 수 없는 상품 id 는 버린다 (null 반환 → 호출하는 쪽에서 거름)
export function toAdProduct(dto: AdProductDto): AdProduct | null
{
    if (!PRODUCT_IDS.includes(dto.id as ProductId))
    {
        return null;
    }
    return {
        id: dto.id as ProductId,
        forKind: FOR_KINDS.includes(dto.for as ProductFor) ? (dto.for as ProductFor) : 'both',
        price: count(dto.price),
        days: count(dto.days),
        nameKo: dto.name_ko?.trim() || (dto.id as string),
        nameEn: dto.name_en?.trim() || dto.name_ko?.trim() || (dto.id as string),
        descKo: dto.desc_ko?.trim() ?? '',
        descEn: dto.desc_en?.trim() ?? dto.desc_ko?.trim() ?? '',
    };
}

export function toExamplePerk(dto: ExamplePerkDto, index: number, now: string): Perk
{
    const action = PERK_ACTIONS.includes(dto.action as PerkAction) ? (dto.action as PerkAction) : 'request';
    return {
        id: dto.id || `perk-ex-${index + 1}`,
        kind: PERK_KINDS.includes(dto.kind as PerkKind) ? (dto.kind as PerkKind) : 'partner',
        action,
        url: action === 'link' && /^https:\/\//.test(dto.url ?? '') ? (dto.url as string) : '',
        providerKo: dto.provider_ko?.trim() || '—',
        providerEn: dto.provider_en?.trim() || dto.provider_ko?.trim() || '—',
        titleKo: dto.title_ko?.trim() || '—',
        titleEn: dto.title_en?.trim() ?? '',
        descKo: dto.desc_ko?.trim() ?? '',
        descEn: dto.desc_en?.trim() ?? '',
        active: true,
        example: true,
        clicks: 0,
        createdAt: now,
    };
}
