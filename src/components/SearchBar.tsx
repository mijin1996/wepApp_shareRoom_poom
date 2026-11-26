// 3칸 검색: 어디로 · 언제부터 · 누구와 (REQ_030, 에어비앤비식 입력 + 우주식 결과)
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { poomApi } from '../api/poomApi';
import type { Suggestion } from '../api/types';
import { useLang, type TextKey } from '../i18n/i18n';
import { shortDate, todayIso } from '../lib/format';
import { useAppState } from '../state/appState';
import { FamilyEditor, familySummary } from './FamilyEditor';
import { Sheet } from './Sheet';

const RECENT_KEY = 'poom.recent';
const MAX_RECENT = 5;
const SUGGEST_DELAY_MS = 300;

export interface PlacePick
{
    readonly id: string;
    readonly label: string;
}

type Panel = 'where' | 'when' | 'who' | null;

function loadRecent(): PlacePick[]
{
    try
    {
        const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
        return Array.isArray(parsed) ? (parsed as PlacePick[]) : [];
    }
    catch (error)
    {
        if (error instanceof SyntaxError)
        {
            return [];
        }
        throw error;
    }
}

interface SearchBarProps
{
    readonly initialPlace?: PlacePick;
    readonly initialMoveIn?: string;
    readonly compact?: boolean;
    readonly onSearch?: (place: PlacePick | undefined, moveIn: string | undefined) => void;
}

export function SearchBar({ initialPlace, initialMoveIn, compact, onSearch }: SearchBarProps)
{
    const { t, lang, path } = useLang();
    const navigate = useNavigate();
    const { children, setChildren } = useAppState();
    const [panel, setPanel] = useState<Panel>(null);
    const [place, setPlace] = useState<PlacePick | undefined>(initialPlace);
    const [moveIn, setMoveIn] = useState<string | undefined>(initialMoveIn);
    const [draftFamily, setDraftFamily] = useState(children);
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [recent, setRecent] = useState<PlacePick[]>(loadRecent);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() =>
    {
        setPlace(initialPlace);
    }, [initialPlace?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() =>
    {
        if (panel !== 'where' || query.trim() === '')
        {
            setSuggestions([]);
            return;
        }
        const timer = setTimeout(async () =>
        {
            const result = await poomApi.suggest(query);
            setSuggestions(result.ok ? result.data : []);
        }, SUGGEST_DELAY_MS);
        return () => clearTimeout(timer);
    }, [query, panel]);

    useEffect(() =>
    {
        if (panel === 'where')
        {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
        if (panel === 'who')
        {
            setDraftFamily(children);
        }
    }, [panel, children]);

    const go = (nextPlace: PlacePick | undefined, nextMoveIn: string | undefined) =>
    {
        setPanel(null);
        if (onSearch)
        {
            onSearch(nextPlace, nextMoveIn);
            return;
        }
        const params = new URLSearchParams();
        if (nextPlace)
        {
            params.set('place', nextPlace.id);
            params.set('placeName', nextPlace.label);
        }
        if (nextMoveIn)
        {
            params.set('moveIn', nextMoveIn);
        }
        navigate(path('/rooms') + (params.toString() ? '?' + params.toString() : ''));
    };

    const pick = (s: Suggestion) =>
    {
        const finalPick: PlacePick = { id: s.id, label: lang === 'en' ? s.nameEn : s.nameKo };
        const updated = [finalPick, ...recent.filter((r) => r.id !== finalPick.id)].slice(0, MAX_RECENT);
        setRecent(updated);
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));   // 기기에만 (POL_SEARCH_03)
        setPlace(finalPick);
        setQuery('');
        setPanel(compact ? null : 'when');
        if (compact)
        {
            go(finalPick, moveIn);
        }
    };

    return (
        <>
            <div className={'searchbar' + (compact ? ' searchbar--compact' : '')} role="search">
                <button type="button" className="searchbar__seg" onClick={() => setPanel('where')}>
                    <span className="searchbar__label">{t('search.where')}</span>
                    <span className="searchbar__value">{place?.label ?? t('search.wherePh')}</span>
                </button>
                <button type="button" className="searchbar__seg" onClick={() => setPanel('when')}>
                    <span className="searchbar__label">{t('search.when')}</span>
                    <span className="searchbar__value">{moveIn ? shortDate(moveIn, lang) : t('search.whenPh')}</span>
                </button>
                <button type="button" className="searchbar__seg" onClick={() => setPanel('who')}>
                    <span className="searchbar__label">{t('search.who')}</span>
                    <span className="searchbar__value">{children.length > 0 ? familySummary(t, children) : t('search.whoPh')}</span>
                </button>
                <button type="button" className="btn btn--primary searchbar__go" onClick={() => go(place, moveIn)}>
                    <span aria-hidden="true">🔍</span>
                    <span>{t('search.go')}</span>
                </button>
            </div>

            <Sheet open={panel === 'where'} title={t('search.where')} onClose={() => setPanel(null)}
                footer={<button type="button" className="btn btn--ghost btn--block" onClick={() =>
                {
                    setPlace(undefined);
                    setPanel(compact ? null : 'when');
                    if (compact)
                    {
                        go(undefined, moveIn);
                    }
                }}>{t('search.anywhere')}</button>}>
                <input ref={inputRef} className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('search.placeholder')} aria-label={t('search.placeholder')} autoComplete="off" />
                {query.trim() === '' && recent.length > 0 && (
                    <div className="suggest">
                        <div className="suggest__head">
                            <span>{t('search.recent')}</span>
                            <button type="button" className="btn btn--ghost btn--small" onClick={() =>
                            {
                                setRecent([]);
                                localStorage.removeItem(RECENT_KEY);
                            }}>{t('search.clear')}</button>
                        </div>
                        {recent.map((r) => (
                            <button type="button" key={r.id} className="suggest__item" onClick={() =>
                            {
                                setPlace(r);
                                setPanel(compact ? null : 'when');
                                if (compact)
                                {
                                    go(r, moveIn);
                                }
                            }}>🕘 {r.label}</button>
                        ))}
                    </div>
                )}
                {query.trim() !== '' && (
                    <div className="suggest" aria-live="polite">
                        {suggestions.length === 0 && <p className="muted">{t('search.noSuggest')}</p>}
                        {suggestions.map((s) => (
                            <button type="button" key={s.id} className="suggest__item" onClick={() => pick(s)}>
                                <span className="tag">{t(('search.kind.' + s.kind) as TextKey)}</span>
                                <span className="suggest__name">{lang === 'en' ? s.nameEn : s.nameKo}</span>
                                <span className="muted suggest__gu">{s.guKo}</span>
                            </button>
                        ))}
                    </div>
                )}
            </Sheet>

            <Sheet open={panel === 'when'} title={t('search.when')} onClose={() => setPanel(null)}
                footer={<div className="btn-row">
                    <button type="button" className="btn btn--ghost" onClick={() =>
                    {
                        setMoveIn(undefined);
                        setPanel(compact ? null : 'who');
                    }}>{t('search.anytime')}</button>
                    <button type="button" className="btn btn--primary" onClick={() => setPanel(compact ? null : 'who')}>{t('apply.next')}</button>
                </div>}>
                <label className="field">
                    <span className="field__label">{t('search.whenPh')}</span>
                    <input className="input" type="date" min={todayIso()} value={moveIn ?? ''} onChange={(e) => setMoveIn(e.target.value || undefined)} />
                </label>
            </Sheet>

            <Sheet open={panel === 'who'} title={t('family.title')} onClose={() => setPanel(null)}
                footer={<button type="button" className="btn btn--primary btn--block" onClick={() =>
                {
                    setChildren(draftFamily);
                    go(place, moveIn);
                }}>{t('search.go')}</button>}>
                <FamilyEditor value={draftFamily} onChange={setDraftFamily} />
            </Sheet>
        </>
    );
}
