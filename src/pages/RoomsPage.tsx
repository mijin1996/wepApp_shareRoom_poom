// 방 찾기 (SCR_ROOM_LIST_01 · SCR_MAP_01): 목록 + 지도, 0건이면 지역 수요 (REQ_036)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { filtersToQuery, poomApi, type RoomFilters } from '../api/poomApi';
import type { MapCluster, RoomView } from '../api/types';
import { FilterSheet } from '../components/FilterSheet';
import { MapView } from '../components/MapView';
import { RoomCard } from '../components/RoomCard';
import { SearchBar, type PlacePick } from '../components/SearchBar';
import { Empty, ErrorBox, Loading } from '../components/States';
import { useLang } from '../i18n/i18n';
import { useAppState } from '../state/appState';

const BOOL_KEYS = ['soon', 'noStairs', 'privateBath', 'playroom', 'parking', 'foreignerOk', 'englishStaff'] as const;

function readFilters(params: URLSearchParams): RoomFilters
{
    const f: RoomFilters = {
        place: params.get('place') ?? undefined,
        type: params.get('type') === 'mom' || params.get('type') === 'dad' ? (params.get('type') as 'mom' | 'dad') : undefined,
        maxDeposit: params.get('maxDeposit') ? Number(params.get('maxDeposit')) : undefined,
        maxMonthly: params.get('maxMonthly') ? Number(params.get('maxMonthly')) : undefined,
        moveIn: params.get('moveIn') ?? undefined,
        near: params.get('near') ?? undefined,
        sort: (params.get('sort') as RoomFilters['sort']) ?? undefined,
    };
    for (const key of BOOL_KEYS)
    {
        if (params.get(key) === '1')
        {
            f[key] = true;
        }
    }
    return f;
}

export function RoomsPage()
{
    const { t, lang } = useLang();
    const { user, children } = useAppState();
    const [params, setParams] = useSearchParams();
    const filters = useMemo(() => readFilters(params), [params]);
    const placeName = params.get('placeName') ?? undefined;
    const [rooms, setRooms] = useState<RoomView[] | undefined>();
    const [clusters, setClusters] = useState<MapCluster[]>([]);
    const [error, setError] = useState<string | undefined>();
    const [view, setView] = useState<'list' | 'map'>('list');
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedDong, setSelectedDong] = useState<string | undefined>();
    const [notice, setNotice] = useState<string | undefined>();

    const query = filtersToQuery(filters, children);

    const load = useCallback(() =>
    {
        setRooms(undefined);
        setError(undefined);
        setNotice(undefined);
        setSelectedDong(undefined);
        void Promise.all([poomApi.rooms(query), poomApi.clusters(query)]).then(([r, c]) =>
        {
            if (r.ok)
            {
                setRooms(r.data);
            }
            else
            {
                setError(r.code);
            }
            setClusters(c.ok ? c.data : []);
        });
    }, [query]);

    useEffect(load, [load]);

    const writeFilters = (next: RoomFilters, nextPlaceName?: string) =>
    {
        const p = new URLSearchParams(filtersToQuery(next, []));
        const name = nextPlaceName ?? placeName;
        if (next.place && name)
        {
            p.set('placeName', name);
        }
        setParams(p);
    };

    const onSearch = (place: PlacePick | undefined, moveIn: string | undefined) =>
    {
        writeFilters({ ...filters, place: place?.id, moveIn }, place?.label);
    };

    const recordDemand = async () =>
    {
        const gu = placeName ?? (lang === 'en' ? 'Seoul' : '서울');
        await poomApi.demand(gu, children.length + 1, filters.maxMonthly);
        setNotice(t('rooms.notified'));
    };

    const saveSearch = async () =>
    {
        const result = await poomApi.saveSearch(params.toString());
        setNotice(result.ok ? t('rooms.searchSaved') : t(('error.' + result.code) as 'error.COMMON_500'));
    };

    const shown = rooms?.filter((r) => !selectedDong || r.dongKo === selectedDong) ?? [];
    const activeCount = Object.entries(filters).filter(([k, v]) => k !== 'place' && k !== 'sort' && k !== 'moveIn' && v !== undefined).length;
    const initialPlace = filters.place ? { id: filters.place, label: placeName ?? filters.place } : undefined;

    return (
        <div className={'page page--rooms view-' + view}>
            <div className="rooms-top">
                <SearchBar compact initialPlace={initialPlace} initialMoveIn={filters.moveIn} onSearch={onSearch} />
                <div className="toolbar">
                    <button type="button" className="btn btn--outline btn--small" onClick={() => setFilterOpen(true)}>
                        ⚙ {t('rooms.filter')}{activeCount > 0 ? ` · ${activeCount}` : ''}
                    </button>
                    <label className="sort">
                        <span className="sr-only">sort</span>
                        <select className="input input--small" value={filters.sort ?? 'soon'} onChange={(e) => writeFilters({ ...filters, sort: e.target.value as RoomFilters['sort'] })}>
                            <option value="soon">{t('rooms.sort.soon')}</option>
                            <option value="cheap">{t('rooms.sort.cheap')}</option>
                            {filters.place && <option value="near">{t('rooms.sort.near')}</option>}
                        </select>
                    </label>
                    <div className="seg view-toggle" role="tablist">
                        <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'seg__on' : ''} onClick={() => setView('list')}>☰ {t('rooms.list')}</button>
                        <button type="button" role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'seg__on' : ''} onClick={() => setView('map')}>🗺 {t('rooms.map')}</button>
                    </div>
                </div>
            </div>

            <div className="rooms-layout">
                <section className="rooms-list" aria-live="polite">
                    {rooms && <p className="muted rooms-count">{t('rooms.count', { n: shown.length })}{selectedDong ? ` · ${selectedDong}` : ''}</p>}
                    {selectedDong && <button type="button" className="btn btn--ghost btn--small" onClick={() => setSelectedDong(undefined)}>✕ {t('rooms.dongAll')}</button>}
                    {error && <ErrorBox code={error} onRetry={load} />}
                    {!error && !rooms && <Loading />}
                    {rooms && rooms.length === 0 && (
                        <Empty icon="🏡" title={placeName ? t('rooms.empty', { place: placeName }) : t('rooms.emptyGeneric')}>
                            <div className="btn-row">
                                <button type="button" className="btn btn--outline" onClick={() => writeFilters({ place: undefined })}>{t('rooms.widen')}</button>
                                <button type="button" className="btn btn--primary" onClick={() => void recordDemand()}>🔔 {t('rooms.notifyArea')}</button>
                            </div>
                        </Empty>
                    )}
                    <div className="room-grid">
                        {shown.map((room) => <RoomCard key={room.roomId} room={room} />)}
                    </div>
                    {rooms && rooms.length > 0 && user && (
                        <button type="button" className="btn btn--outline btn--block" onClick={() => void saveSearch()}>🔔 {t('rooms.saveSearch')}</button>
                    )}
                    {notice && <p className="notice notice--ok" role="status">{notice}</p>}
                </section>
                <section className="rooms-map">
                    <MapView clusters={clusters} selectedDong={selectedDong} onSelect={setSelectedDong} />
                </section>
            </div>

            <FilterSheet open={filterOpen} value={filters} onClose={() => setFilterOpen(false)} onApply={(next) =>
            {
                setFilterOpen(false);
                writeFilters(next);
            }} />
        </div>
    );
}
