// 필터 더 보기 (REQ_033) — 결과 수를 버튼에 보여 준다
import { useEffect, useState } from 'react';
import { filtersToQuery, poomApi, type RoomFilters } from '../api/poomApi';
import { useLang, type TextKey } from '../i18n/i18n';
import { won } from '../lib/format';
import { useAppState } from '../state/appState';
import { Sheet } from './Sheet';

const DEPOSIT_STEPS = [undefined, 400000, 500000, 600000, 800000, 1000000];
const MONTHLY_STEPS = [undefined, 250000, 300000, 350000, 400000, 500000];
const TOGGLES: readonly (keyof RoomFilters)[] = ['soon', 'noStairs', 'privateBath', 'playroom', 'parking', 'foreignerOk', 'englishStaff'];

interface FilterSheetProps
{
    readonly open: boolean;
    readonly value: RoomFilters;
    readonly onClose: () => void;
    readonly onApply: (next: RoomFilters) => void;
}

export function FilterSheet({ open, value, onClose, onApply }: FilterSheetProps)
{
    const { t, lang } = useLang();
    const { children } = useAppState();
    const [draft, setDraft] = useState<RoomFilters>(value);
    const [count, setCount] = useState<number | undefined>();

    useEffect(() =>
    {
        if (open)
        {
            setDraft(value);
        }
    }, [open, value]);

    useEffect(() =>
    {
        if (!open)
        {
            return;
        }
        let alive = true;
        void poomApi.rooms(filtersToQuery(draft, children)).then((r) =>
        {
            if (alive)
            {
                setCount(r.ok ? r.data.length : undefined);
            }
        });
        return () =>
        {
            alive = false;
        };
    }, [draft, children, open]);

    const set = (patch: Partial<RoomFilters>) => setDraft((d) => ({ ...d, ...patch }));

    return (
        <Sheet open={open} title={t('filter.title')} onClose={onClose}
            footer={<div className="btn-row">
                <button type="button" className="btn btn--ghost" onClick={() => setDraft({ place: value.place, sort: value.sort, moveIn: value.moveIn })}>{t('filter.reset')}</button>
                <button type="button" className="btn btn--primary" onClick={() => onApply(draft)}>
                    {t('filter.apply')}{count !== undefined ? ` (${count})` : ''}
                </button>
            </div>}>
            <fieldset className="field">
                <legend className="field__label">{t('filter.house')}</legend>
                <div className="seg seg--wrap">
                    {([undefined, 'mom', 'dad'] as const).map((type) => (
                        <button type="button" key={type ?? 'any'} className={draft.type === type ? 'seg__on' : ''} aria-pressed={draft.type === type}
                            onClick={() => set({ type })}>
                            {t(type === 'mom' ? 'filter.mom' : type === 'dad' ? 'filter.dad' : 'filter.any')}
                        </button>
                    ))}
                </div>
            </fieldset>
            <label className="field">
                <span className="field__label">{t('filter.maxDeposit')}</span>
                <select className="input" value={draft.maxDeposit ?? ''} onChange={(e) => set({ maxDeposit: e.target.value ? Number(e.target.value) : undefined })}>
                    {DEPOSIT_STEPS.map((v) => <option key={v ?? 0} value={v ?? ''}>{v ? won(v, lang) : t('filter.noLimit')}</option>)}
                </select>
            </label>
            <label className="field">
                <span className="field__label">{t('filter.maxMonthly')}</span>
                <select className="input" value={draft.maxMonthly ?? ''} onChange={(e) => set({ maxMonthly: e.target.value ? Number(e.target.value) : undefined })}>
                    {MONTHLY_STEPS.map((v) => <option key={v ?? 0} value={v ?? ''}>{v ? won(v, lang) : t('filter.noLimit')}</option>)}
                </select>
            </label>
            <label className="field">
                <span className="field__label">{t('filter.near')}</span>
                <select className="input" value={draft.near ?? ''} onChange={(e) => set({ near: e.target.value || undefined })}>
                    <option value="">{t('filter.noLimit')}</option>
                    {['school_e', 'school_m', 'daycare', 'station', 'pediatric'].map((k) => <option key={k} value={k}>{t(('poi.' + k) as TextKey)}</option>)}
                </select>
            </label>
            <div className="toggles">
                {TOGGLES.map((key) => (
                    <label className="toggle" key={key}>
                        <input type="checkbox" checked={Boolean(draft[key])} onChange={(e) => set({ [key]: e.target.checked } as Partial<RoomFilters>)} />
                        <span>{t(('filter.' + key) as TextKey)}</span>
                    </label>
                ))}
            </div>
        </Sheet>
    );
}
