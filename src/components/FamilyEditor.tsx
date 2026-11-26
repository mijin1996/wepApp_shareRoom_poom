// 우리 가족: 자녀 나이대 · 성별만 (POL_PRIVACY_01). 필요한 침실 수를 바로 보여 준다 (POL_ROOM_01)
import { AGE_BANDS, type AgeBand, type ChildDraft } from '../api/types';
import { useLang } from '../i18n/i18n';
import { MAX_SHARE_HOUSEHOLD, requiredBedrooms } from '../../server/rules/housingStandard';

const MAX_CHILDREN = 6;

interface FamilyEditorProps
{
    readonly value: readonly ChildDraft[];
    readonly onChange: (next: readonly ChildDraft[]) => void;
}

export function familySummary(t: ReturnType<typeof useLang>['t'], children: readonly ChildDraft[]): string
{
    if (children.length === 0)
    {
        return t('family.none');
    }
    return t('family.summary', { size: children.length + 1, rooms: requiredBedrooms(children) });
}

export function FamilyEditor({ value, onChange }: FamilyEditorProps)
{
    const { t } = useLang();

    const update = (index: number, patch: Partial<ChildDraft>) =>
    {
        onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    };

    return (
        <div className="family">
            <div className="family__row family__row--parent">
                <span aria-hidden="true">🧑</span>
                <span>{t('family.parent')}</span>
            </div>
            {value.map((child, index) => (
                <fieldset className="family__row" key={index}>
                    <legend className="sr-only">{t('family.title')} {index + 1}</legend>
                    <label className="field field--inline">
                        <span className="field__label">{t('family.age')}</span>
                        <select value={child.ageBand} onChange={(e) => update(index, { ageBand: e.target.value as AgeBand })}>
                            {AGE_BANDS.map((band) => (
                                <option key={band} value={band}>{t(('age.' + band) as 'age.0-5')}</option>
                            ))}
                        </select>
                    </label>
                    <div className="seg" role="radiogroup" aria-label={t('family.age')}>
                        <button type="button" role="radio" aria-checked={child.gender === 'm'} className={child.gender === 'm' ? 'seg__on' : ''} onClick={() => update(index, { gender: 'm' })}>{t('family.boy')}</button>
                        <button type="button" role="radio" aria-checked={child.gender === 'f'} className={child.gender === 'f' ? 'seg__on' : ''} onClick={() => update(index, { gender: 'f' })}>{t('family.girl')}</button>
                    </div>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange(value.filter((_, i) => i !== index))}>{t('family.remove')}</button>
                </fieldset>
            ))}
            {value.length < MAX_CHILDREN && (
                <button type="button" className="btn btn--outline btn--block" onClick={() => onChange([...value, { ageBand: '0-5', gender: 'f' }])}>
                    {t('family.addChild')}
                </button>
            )}
            <p className={'family__summary' + (value.length + 1 > MAX_SHARE_HOUSEHOLD ? ' family__summary--warn' : '')} aria-live="polite">
                {value.length + 1 > MAX_SHARE_HOUSEHOLD ? t('family.tooLarge') : familySummary(t, value)}
            </p>
        </div>
    );
}
