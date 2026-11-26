// 내 집 (SCR_MY_01): 신청 진행 · 서류 · 계약 서명 · 결제 · 입주 안내 · 관심 방 · 빈방 알림 · 내 신고
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { poomApi } from '../api/poomApi';
import type { ApplicationView, ContractView, DocType, MoveInView, ReportView, RoomView } from '../api/types';
import { RoomCard } from '../components/RoomCard';
import { ErrorBox, Loading } from '../components/States';
import { useLang, type TextKey } from '../i18n/i18n';
import { shortDate, won } from '../lib/format';
import { useAppState } from '../state/appState';
import { DocPicker } from './ApplyPage';

interface IMyData
{
    apps: ApplicationView[];
    contracts: ContractView[];
    moveIn: MoveInView | undefined;
    reports: ReportView[];
    searches: { id: string; query: string }[];
    favoriteRooms: RoomView[];
}

function Timeline({ app, contract }: { app: ApplicationView; contract: ContractView | undefined })
{
    const { t } = useLang();
    const steps: readonly [TextKey, boolean][] = [
        ['my.timeline.apply', true],
        ['my.timeline.call', app.status === 'approved'],
        ['my.timeline.doc', Boolean(app.document?.checked)],
        ['my.timeline.sign', Boolean(contract)],
        ['my.timeline.pay', Boolean(contract?.paid)],
        ['my.timeline.movein', Boolean(contract?.paid)],
    ];
    return (
        <ol className="timeline">
            {steps.map(([key, done]) => (
                <li key={key} className={done ? 'is-done' : ''}>
                    <span className="timeline__dot" aria-hidden="true">{done ? '✓' : ''}</span>
                    <span className="timeline__label">{t(key)}</span>
                </li>
            ))}
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
    const [readAll, setReadAll] = useState(false);
    const [signature, setSignature] = useState('');
    const [payMethod, setPayMethod] = useState('card');

    const load = useCallback(async () =>
    {
        setError(undefined);
        const [apps, contracts, moveIn, reports, searches] = await Promise.all([
            poomApi.myApplications(), poomApi.myContracts(), poomApi.moveIn(), poomApi.myReports(), poomApi.savedSearches(),
        ]);
        if (!apps.ok)
        {
            setError(apps.code);
            return;
        }
        const favoriteRooms = (await Promise.all([...favorites].map((id) => poomApi.room(id, [])))).flatMap((r) => (r.ok ? [r.data] : []));
        setData({
            apps: apps.data,
            contracts: contracts.ok ? contracts.data : [],
            moveIn: moveIn.ok ? moveIn.data : undefined,
            reports: reports.ok ? reports.data : [],
            searches: searches.ok ? searches.data : [],
            favoriteRooms,
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

    const active = data?.apps.find((a) => a.status !== 'rejected');
    const contract = active ? data?.contracts.find((c) => c.applicationId === active.id) : undefined;

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
                        <h2>{t('my.applications')}</h2>
                        {!active && (
                            <div className="state state--empty">
                                <p>{t('my.none')}</p>
                                <Link className="btn btn--primary" to={path('/rooms')}>{t('nav.rooms')}</Link>
                            </div>
                        )}
                        {active && (
                            <>
                                <p>
                                    <span className={'tag tag--status-' + active.status}>{t(('my.status.' + active.status) as TextKey)}</span>{' '}
                                    <Link to={path('/rooms/' + active.roomId)}>{active.roomId}</Link> · {shortDate(active.moveInDate, lang)} · {t('apply.monthsValue', { n: active.months })}
                                </p>
                                <Timeline app={active} contract={contract} />

                                {!contract && (
                                    <div className="my-step">
                                        {!active.document && (
                                            <>
                                                <p className="notice">{t('my.docNeeded')}</p>
                                                <DocPicker value={docDraft} onChange={setDocDraft} idType={user.idType} />
                                                <button type="button" className="btn btn--primary btn--block" disabled={!docDraft}
                                                    onClick={() => void act(() => poomApi.uploadDoc(active.id, docDraft as DocType))}>{t('my.uploadDoc')}</button>
                                            </>
                                        )}
                                        {active.document && !active.document.checked && <p className="notice">⏳ {t('my.docChecking')}</p>}
                                        {active.document?.checked && <p className="notice notice--ok">✓ {t('my.docOk')}</p>}

                                        {active.status === 'approved' && active.document?.checked && (
                                            <div className="contract">
                                                <h3>{t('my.contract')}</h3>
                                                {lang === 'en' && <p className="notice">{t('my.contractNote')}</p>}
                                                <div className="contract__doc" tabIndex={0} onScroll={(e) =>
                                                {
                                                    const el = e.currentTarget;
                                                    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8)
                                                    {
                                                        setReadAll(true);
                                                    }
                                                }}>
                                                    <p><strong>제1조 (목적)</strong> 임대인 품(Poom)과 임차인은 아래 방의 주거용 임대차에 합의한다.</p>
                                                    <p><strong>제2조 (기간 · 비용)</strong> 계약 기간, 보증금, 월 임대료, 관리비는 신청 내용과 방 정보에 따른다.</p>
                                                    <p><strong>제3조 (보증금 반환)</strong> 퇴실 점검 후 7일 안에 반환하며, 방에 표시된 퇴실 청소비를 뺀다.</p>
                                                    <p><strong>제4조 (하우스 규칙)</strong> 임차인은 하우스 규칙을 지킨다. 안전을 해치는 행동은 계약 해지 사유가 된다.</p>
                                                    <p><strong>제5조 (중도 퇴실)</strong> 30일 전에 알리면 위약금이 없다.</p>
                                                    <p className="muted">테스트판 계약서 예시 — 실제 계약서는 법무 검토 후 확정 (D13-LEGAL)</p>
                                                </div>
                                                <label className="toggle">
                                                    <input type="checkbox" checked={readAll} onChange={(e) => setReadAll(e.target.checked)} />
                                                    <span>{t('my.readAll')}</span>
                                                </label>
                                                <label className="field">
                                                    <span className="field__label">{t('my.signature')}</span>
                                                    <input className="input input--signature" value={signature} onChange={(e) => setSignature(e.target.value)} />
                                                </label>
                                                <button type="button" className="btn btn--primary btn--block" disabled={!readAll || signature.trim().length < 2}
                                                    onClick={() => void act(() => poomApi.sign(active.id, signature))}>{t('my.sign')}</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {contract && !contract.paid && (
                                    <div className="my-step">
                                        <h3>{t('my.pay')}</h3>
                                        <p>{t('my.contractSummary', { months: contract.months, deposit: won(contract.deposit, lang), monthly: won(contract.rent + contract.fee, lang) })}</p>
                                        <p className="price-big">{t('my.payAmount', { amount: won(contract.deposit + contract.rent + contract.fee, lang) })}</p>
                                        <div className="seg seg--wrap">
                                            {(['card', 'transfer', 'easy'] as const).map((m) => (
                                                <button type="button" key={m} className={payMethod === m ? 'seg__on' : ''} aria-pressed={payMethod === m} onClick={() => setPayMethod(m)}>{t(('my.payMethod.' + m) as TextKey)}</button>
                                            ))}
                                        </div>
                                        {__APP_CHANNEL__ === 'test' && <p className="muted">🧪 {t('my.payMock')}</p>}
                                        <button type="button" className="btn btn--primary btn--block" onClick={() => void act(() => poomApi.pay(contract.id, payMethod))}>{t('my.pay')}</button>
                                    </div>
                                )}

                                {data.moveIn && (
                                    <div className="my-step movein">
                                        <h3>🏡 {t('my.movein')}</h3>
                                        <dl className="kv">
                                            <dt>{t('my.address')}</dt><dd>{data.moveIn.address}</dd>
                                            <dt>{t('my.entry')}</dt><dd>{lang === 'en' ? data.moveIn.entryInfoEn : data.moveIn.entryInfoKo}</dd>
                                        </dl>
                                        <ul className="rules">{(lang === 'en' ? data.moveIn.rulesEn : data.moveIn.rulesKo).map((r) => <li key={r}>{r}</li>)}</ul>
                                    </div>
                                )}
                            </>
                        )}
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
