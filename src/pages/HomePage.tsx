// 홈 (SCR_HOME_01): 3칸 검색 · 추천 칩 · 바로 입주 방 · 지역별 · 이용 방법
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { filtersToQuery, poomApi, type RoomFilters } from '../api/poomApi';
import type { RoomView } from '../api/types';
import { RoomCard } from '../components/RoomCard';
import { SearchBar } from '../components/SearchBar';
import { ErrorBox, Loading } from '../components/States';
import { useLang, type TextKey } from '../i18n/i18n';
import { PinnedNoticeStrip } from './NoticePages';
import { useAppState } from '../state/appState';

const CHIPS: readonly { key: TextKey; filters: RoomFilters }[] = [
    { key: 'chip.soon', filters: { soon: true } },
    { key: 'chip.cheap', filters: { maxDeposit: 500000 } },
    { key: 'chip.school', filters: { near: 'school_e' } },
    { key: 'chip.mom', filters: { type: 'mom' } },
    { key: 'chip.dad', filters: { type: 'dad' } },
    { key: 'chip.english', filters: { englishStaff: true } },
];

const AREAS = [
    { id: 'gu-mapo', ko: '마포구', en: 'Mapo-gu' },
    { id: 'gu-eunpyeong', ko: '은평구', en: 'Eunpyeong-gu' },
    { id: 'gu-gwanak', ko: '관악구', en: 'Gwanak-gu' },
    { id: 'gu-nowon', ko: '노원구', en: 'Nowon-gu' },
    { id: 'gu-songpa', ko: '송파구', en: 'Songpa-gu' },
    { id: 'gu-gangseo', ko: '강서구', en: 'Gangseo-gu' },
];

export function HomePage()
{
    const { t, lang, path } = useLang();
    const navigate = useNavigate();
    const { children } = useAppState();
    const [rooms, setRooms] = useState<RoomView[] | undefined>();
    const [error, setError] = useState<string | undefined>();

    const load = () =>
    {
        setError(undefined);
        void poomApi.rooms(filtersToQuery({ soon: true }, children)).then((r) =>
        {
            if (r.ok)
            {
                setRooms(r.data);
            }
            else
            {
                setError(r.code);
            }
        });
    };
    useEffect(load, [children]);   // eslint-disable-line react-hooks/exhaustive-deps

    const goChip = (filters: RoomFilters) =>
    {
        navigate(path('/rooms') + '?' + new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, v === true ? '1' : String(v)])).toString());
    };

    return (
        <div className="page page--home">
            <section className="hero">
                <h1 className="hero__title">{t('home.title')}</h1>
                <p className="hero__sub">{t('home.sub')}</p>
                <SearchBar />
                <div className="chips" role="list">
                    {CHIPS.map((chip) => (
                        <button type="button" role="listitem" key={chip.key} className="chip" onClick={() => goChip(chip.filters)}>{t(chip.key)}</button>
                    ))}
                </div>
            </section>

            <PinnedNoticeStrip />
            <Link className="card guide-link" to={path('/guide')}>
                <span aria-hidden="true">❔</span>
                <span className="guide-link__text">{t('home.guideLink')}</span>
                <span aria-hidden="true">→</span>
            </Link>

            <section className="section">
                <div className="section__head">
                    <h2>{t('home.soon')}</h2>
                    <Link to={path('/rooms?soon=1')} className="btn btn--ghost btn--small">{t('home.seeAll')} →</Link>
                </div>
                {error && <ErrorBox code={error} onRetry={load} />}
                {!error && !rooms && <Loading />}
                {rooms && (
                    <div className="hscroll">
                        {rooms.slice(0, 6).map((room) => <RoomCard key={room.roomId} room={room} />)}
                    </div>
                )}
            </section>

            <section className="section">
                <h2>{t('home.byArea')}</h2>
                <div className="area-grid">
                    {AREAS.map((a) => (
                        <Link key={a.id} className="area" to={path('/rooms') + `?place=${a.id}&placeName=${encodeURIComponent(lang === 'en' ? a.en : a.ko)}`}>
                            {lang === 'en' ? a.en : a.ko}
                        </Link>
                    ))}
                </div>
            </section>

            <section className="section">
                <h2>{t('home.steps')}</h2>
                <ol className="steps">
                    {(['1', '2', '3'] as const).map((n) => (
                        <li key={n} className="step">
                            <span className="step__num">{n}</span>
                            <div>
                                <p className="step__title">{t(('home.step' + n) as TextKey)}</p>
                                <p className="muted">{t(('home.step' + n + 'd') as TextKey)}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="section">
                <Link to={path('/advertise')} className="cta-card">
                    <span aria-hidden="true">🤝</span>
                    <span>{t('home.partnerCta')}</span>
                    <span aria-hidden="true">→</span>
                </Link>
            </section>
        </div>
    );
}
