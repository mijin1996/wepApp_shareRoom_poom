// 내 집 (SCR_MY_01): 내 문의 진행 · 서류함 · 관심 방 · 빈방 알림 · 내 신고
// 품은 문의를 전달하고 진행만 보여 줌 — 계약 · 방값은 광고한 분과 직접 (POL_INQUIRY)
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { poomApi } from '../api/poomApi';
import { INQUIRY_STEPS, type DocType, type DocumentView, type InquiryStatus, type InquiryView, type ReportView, type RoomView } from '../api/types';
import { RoomCard } from '../components/RoomCard';
import { ErrorBox, Loading } from '../components/States';
import { useLang, type TextKey } from '../i18n/i18n';
import { shortDate } from '../lib/format';
import { useAppState } from '../state/appState';
import { DocPicker } from './ApplyPage';

interface IMyData
{
    inquiries: InquiryView[];
    rooms: Map<string, RoomView>;
    document: DocumentView | undefined;
    reports: ReportView[];
    searches: { id: string; query: string }[];
    favoriteRooms: RoomView[];
}

// 진행 표시: 보냄 → 연락 옴 → 집 보기 → 계약함
export function InquirySteps({ status }: { status: InquiryStatus })
{
    const { t } = useLang();
    const at = INQUIRY_STEPS.indexOf(status);
    return (
        <ol className="timeline">
            {INQUIRY_STEPS.map((step, i) =>
            {
                const done = status !== 'closed' && i <= at;
                return (
                    <li key={step} className={done ? 'is-done' : ''}>
                        <span className="timeline__dot" aria-hidden="true">{done ? '✓' : ''}</span>
                        <span className="timeline__label">{t(('inquiry.status.' + step) as TextKey)}</span>
                    </li>
                );
            })}
        </ol>
    );
}

export function MyPage()
{
    const { t, lang, path } = useLang();
    const { user, ready, signOut, favorites } = useAppState();
    const [data, setData] = useState<IMyData | undefined>();
    const [error, setError] = useState<string | undefined>();
    const [actionError, setActionError] = useState<string | undefined>();
    const [docDraft, setDocDraft] = useState<DocType | undefined>();

    const load = useCallback(async () =>
    {
        setError(undefined);
        const [inquiries, doc, reports, searches] = await Promise.all([
            poomApi.myInquiries(), poomApi.myDocument(), poomApi.myReports(), poomApi.savedSearches(),
        ]);
        if (!inquiries.ok)
        {
            setError(inquiries.code);
            return;
        }
        const roomIds = [...new Set([...inquiries.data.map((q) => q.roomId), ...favorites])];
        const found = (await Promise.all(roomIds.map((id) => poomApi.room(id, [])))).flatMap((r) => (r.ok ? [r.data] : []));
        const rooms = new Map(found.map((r) => [r.roomId, r]));
        setData({
            inquiries: inquiries.data,
            rooms,
            document: doc.ok ? doc.data.document ?? undefined : undefined,
            reports: reports.ok ? reports.data : [],
            searches: searches.ok ? searches.data : [],
            favoriteRooms: [...favorites].flatMap((id) => (rooms.has(id) ? [rooms.get(id) as RoomView] : [])),
        });
    }, [favorites]);

    useEffect(() =>
    {
        if (user)
        {
            void load();
        }
    }, [user, load]);

    if (!ready)
    {
        return <div className="page"><Loading /></div>;
    }
    if (!user)
    {
        return (
            <div className="page page--narrow">
                <div className="state state--empty">
                    <span className="state__icon" aria-hidden="true">🔑</span>
                    <p className="state__title">{t('my.login')}</p>
                    <Link className="btn btn--primary" to={path('/auth') + '?next=' + encodeURIComponent(path('/my'))}>{t('auth.submit')}</Link>
                </div>
            </div>
        );
    }

    const act = async (run: () => Promise<{ ok: boolean; code?: string }>) =>
    {
        setActionError(undefined);
        const result = await run();
        if (!result.ok)
        {
            setActionError(result.code);
        }
        await load();
    };

    const open = data?.inquiries.filter((q) => q.status !== 'closed') ?? [];
    const closedCount = (data?.inquiries.length ?? 0) - open.length;

    return (
        <div className="page page--my">
            <div className="section__head">
                <h1>{t('my.title')}</h1>
                <button type="button" className="btn btn--ghost btn--small" onClick={signOut}>{t('auth.logout')}</button>
            </div>
            <p className="muted">{user.name} · {user.phone.replace(/(\d{3})\d+(\d{4})/, '$1-****-$2')}</p>
            {error && <ErrorBox code={error} onRetry={() => void load()} />}
            {!data && !error && <Loading />}
            {actionError && <ErrorBox code={actionError} />}

            {data && (
                <div className="my-grid">
                    <section className="card my-card my-card--main">
                        <h2>{t('my.inquiries')}</h2>
                        <p className="muted">{t('my.inquiriesNote')}</p>
                        {open.length === 0 && (
                            <div className="state state--empty">
                                <p>{t('my.none')}</p>
                                <Link className="btn btn--primary" to={path('/rooms')}>{t('nav.rooms')}</Link>
                            </div>
                        )}
                        <ul className="inquiry-list">
                            {open.map((q) =>
                            {
                                const room = data.rooms.get(q.roomId);
                                return (
                                    <li key={q.id} className="inquiry">
                                        <p className="inquiry__head">
                                            <Link to={path('/rooms/' + q.roomId)}>{room ? (lang === 'en' ? room.houseNameEn : room.houseNameKo) : t('my.roomGone')}</Link>
                                            {room && <span className="muted"> · {t(room.listedBy === 'agent' ? 'ad.byAgent' : 'ad.byOwner')} {lang === 'en' ? room.advertiserNameEn : room.advertiserNameKo}</span>}
                                        </p>
                                        <p className="muted">{shortDate(q.moveInDate, lang)} · {t('apply.monthsValue', { n: q.months })}</p>
                                        <InquirySteps status={q.status} />
                                        {q.status !== 'contracted' && (
                                            <div className="btn-row btn-row--start">
                                                {q.docShared
                                                    ? <span className="tag tag--fit">📄 {t('my.docSent')}</span>
                                                    : <button type="button" className="btn btn--outline btn--small" disabled={!data.document} onClick={() => void act(() => poomApi.shareDoc(q.id))}>📄 {t('my.shareDoc')}</button>}
                                                <button type="button" className="btn btn--ghost btn--small" disabled={!q.docShared} onClick={() => void act(() => poomApi.setInquiryStatus(q.id, 'contracted'))}>{t('my.markContracted')}</button>
                                                <button type="button" className="btn btn--ghost btn--small" onClick={() => void act(() => poomApi.setInquiryStatus(q.id, 'closed'))}>{t('my.closeInquiry')}</button>
                                            </div>
                                        )}
                                        {!data.document && q.status !== 'contracted' && <p className="muted">{t('my.docFirst')}</p>}
                                    </li>
                                );
                            })}
                        </ul>
                        {closedCount > 0 && <p className="muted">{t('my.closedCount', { n: closedCount })}</p>}
                    </section>

                    <section className="card my-card" id="docbox">
                        <h2>📄 {t('my.docBox')}</h2>
                        <p className="muted">{t('my.docBoxNote')}</p>
                        {data.document && (
                            <p className={'notice' + (data.document.checked ? ' notice--ok' : '')}>
                                {data.document.checked ? '✓ ' + t('my.docOk') : '⏳ ' + t('my.docChecking')} · {t(('doc.' + data.document.docType) as TextKey)}
                            </p>
                        )}
                        <DocPicker value={docDraft} onChange={setDocDraft} idType={user.idType} />
                        <button type="button" className="btn btn--primary btn--block" disabled={!docDraft}
                            onClick={() => void act(() => poomApi.uploadDoc(docDraft as DocType))}>{data.document ? t('my.replaceDoc') : t('my.uploadDoc')}</button>
                    </section>

                    <section className="card my-card">
                        <h2>📣 {t('my.advertiserTitle')}</h2>
                        <p className="muted">{t('my.advertiserNote')}</p>
                        <Link className="btn btn--outline btn--block" to={path('/advertise')}>{t('nav.advertise')}</Link>
                    </section>

                    <section className="card my-card">
                        <h2>{t('my.favorites')}</h2>
                        {data.favoriteRooms.length === 0 ? <p className="muted">{t('admin.empty')}</p> : (
                            <div className="room-grid room-grid--one">{data.favoriteRooms.map((r) => <RoomCard key={r.roomId} room={r} />)}</div>
                        )}
                    </section>

                    <section className="card my-card">
                        <h2>{t('my.savedSearches')}</h2>
                        {data.searches.length === 0 ? <p className="muted">{t('admin.empty')}</p> : (
                            <ul className="list">
                                {data.searches.map((s) => (
                                    <li key={s.id} className="list__row">
                                        <Link to={path('/rooms') + '?' + s.query} className="list__main">🔔 {new URLSearchParams(s.query).get('placeName') ?? s.query}</Link>
                                        <button type="button" className="btn btn--ghost btn--small" onClick={() => void act(() => poomApi.deleteSearch(s.id))}>{t('my.remove')}</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="card my-card">
                        <h2>{t('my.reports')}</h2>
                        {data.reports.length === 0 ? <p className="muted">{t('admin.empty')}</p> : (
                            <ul className="list">
                                {data.reports.map((r) => (
                                    <li key={r.id} className="list__row list__row--stack">
                                        <span><span className="tag">{r.status}</span> {r.message}</span>
                                        {r.replies.map((reply, i) => <span key={i} className="notice">💬 {t('my.reply')}: {reply}</span>)}
                                        {r.status === 'done' && r.resolvedByReporter === undefined && (
                                            <div className="btn-row btn-row--start">
                                                <button type="button" className="btn btn--outline btn--small" onClick={() => void act(() => poomApi.confirmReport(r.id, true))}>{t('my.reportResolved')}</button>
                                                <button type="button" className="btn btn--ghost btn--small" onClick={() => void act(() => poomApi.confirmReport(r.id, false))}>{t('my.reportNotYet')}</button>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
