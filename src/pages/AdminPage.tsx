// 운영 콘솔 (D09-ADMIN): 신청 승인 · 서류 확인 · 신고함(상태 · 심각도 · 처리 기록) · 지역 수요 · 제휴 문의
import { useCallback, useEffect, useState } from 'react';
import { getAdminKey, setAdminKey } from '../api/http';
import { poomApi } from '../api/poomApi';
import type { ApplicationView, DemandView, PartnerView, ReportView } from '../api/types';
import { ErrorBox } from '../components/States';
import { useLang, type TextKey } from '../i18n/i18n';
import { describe } from '../lib/trail';

type Tab = 'apps' | 'reports' | 'demand' | 'partners';
const STATUSES = ['received', 'checking', 'in_progress', 'done', 'on_hold', 'duplicate'];
const SEVERITIES = ['critical', 'high', 'normal', 'low'];
const PRIORITIES = ['P1', 'P2', 'P3'];

function ReportItem({ report, onSaved }: { report: ReportView; onSaved: () => void })
{
    const { t } = useLang();
    const [status, setStatus] = useState(report.status as string);
    const [severity, setSeverity] = useState(report.severity ?? '');
    const [priority, setPriority] = useState(report.priority ?? '');
    const [cause, setCause] = useState(report.resolution?.cause ?? '');
    const [fix, setFix] = useState(report.resolution?.fix ?? '');
    const [verify, setVerify] = useState(report.resolution?.verify ?? '');
    const [reply, setReply] = useState('');
    const [error, setError] = useState<string | undefined>();
    const created = Date.parse(report.createdAt);

    const save = async () =>
    {
        const r = await poomApi.admin.updateReport(report.id, {
            status, severity: severity || undefined, priority: priority || undefined,
            resolution: cause || fix || verify ? { cause, fix, verify } : undefined,
        });
        setError(r.ok ? undefined : r.code);
        if (r.ok)
        {
            onSaved();
        }
    };

    return (
        <details className={'card report' + (report.kind === 'safety' ? ' report--safety' : '')}>
            <summary className="report__summary">
                <span className="tag">{report.kind}</span>
                <span className="tag tag--muted">{report.status}</span>
                <span className="report__msg">{report.message}</span>
                <span className="muted">{report.channel} v{report.version} · {report.screenId}</span>
            </summary>
            <div className="report__body">
                {report.shot && <img className="report__shot" src={report.shot} alt="screenshot" />}
                <div>
                    <h4>{t('admin.trail')}</h4>
                    <pre className="trail">{report.trail.length === 0 ? '—' : report.trail.map((e) => describe(e, created)).join('\n')}</pre>
                    <p className="muted">{Object.entries(report.env).map(([k, v]) => `${k}=${v}`).join(' · ')}</p>
                    <p className="muted">{report.statusLog.map((l) => `${l.at.slice(5, 16)} ${l.from}→${l.to} (${l.by})`).join(' / ')}</p>
                </div>
                <div className="form form--grid">
                    <label className="field"><span className="field__label">{t('admin.status')}</span>
                        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
                    <label className="field"><span className="field__label">{t('admin.severity')}</span>
                        <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="">—</option>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></label>
                    <label className="field"><span className="field__label">{t('admin.priority')}</span>
                        <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">—</option>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></label>
                    <label className="field"><span className="field__label">{t('admin.cause')}</span><input className="input" value={cause} onChange={(e) => setCause(e.target.value)} /></label>
                    <label className="field"><span className="field__label">{t('admin.fix')}</span><input className="input" value={fix} onChange={(e) => setFix(e.target.value)} /></label>
                    <label className="field"><span className="field__label">{t('admin.verify')}</span><input className="input" value={verify} onChange={(e) => setVerify(e.target.value)} /></label>
                </div>
                {error && <ErrorBox code={error} />}
                <div className="btn-row btn-row--start">
                    <button type="button" className="btn btn--primary btn--small" onClick={() => void save()}>{t('admin.save')}</button>
                </div>
                {report.replies.map((r, i) => <p key={i} className="notice">💬 {r}</p>)}
                <div className="inline-form">
                    <input className="input" value={reply} onChange={(e) => setReply(e.target.value)} aria-label={t('admin.reply')} />
                    <button type="button" className="btn btn--outline btn--small" disabled={!reply.trim()} onClick={() => void poomApi.admin.reply(report.id, reply).then(() =>
                    {
                        setReply('');
                        onSaved();
                    })}>{t('admin.reply')}</button>
                </div>
            </div>
        </details>
    );
}

export function AdminPage()
{
    const { t } = useLang();
    const [key, setKey] = useState(getAdminKey());
    const [entered, setEntered] = useState(Boolean(getAdminKey()));
    const [tab, setTab] = useState<Tab>('apps');
    const [apps, setApps] = useState<ApplicationView[]>([]);
    const [reports, setReports] = useState<ReportView[]>([]);
    const [demand, setDemand] = useState<DemandView[]>([]);
    const [partners, setPartners] = useState<PartnerView[]>([]);
    const [error, setError] = useState<string | undefined>();

    const load = useCallback(async () =>
    {
        const [a, r, d, p] = await Promise.all([poomApi.admin.applications(), poomApi.admin.reports(), poomApi.admin.demand(), poomApi.admin.partners()]);
        if (!a.ok)
        {
            setError(a.code);
            setEntered(false);
            return;
        }
        setError(undefined);
        setApps(a.data);
        setReports(r.ok ? r.data : []);
        setDemand(d.ok ? d.data : []);
        setPartners(p.ok ? p.data : []);
    }, []);

    useEffect(() =>
    {
        if (entered)
        {
            void load();
        }
    }, [entered, load]);

    if (!entered)
    {
        return (
            <div className="page page--narrow">
                <h1>{t('admin.title')}</h1>
                <form className="form" onSubmit={(e) =>
                {
                    e.preventDefault();
                    setAdminKey(key);
                    setEntered(true);
                }}>
                    <label className="field">
                        <span className="field__label">{t('admin.key')}</span>
                        <input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
                    </label>
                    {__APP_CHANNEL__ === 'test' && <p className="muted">🧪 {t('admin.keyHint')}</p>}
                    {error && <ErrorBox code={error} />}
                    <button type="submit" className="btn btn--primary btn--block">{t('admin.enter')}</button>
                </form>
            </div>
        );
    }

    const decide = async (id: string, decision: string) =>
    {
        await poomApi.admin.decide(id, decision);
        await load();
    };

    return (
        <div className="page page--admin">
            <div className="section__head">
                <h1>{t('admin.title')}</h1>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => void load()}>↻ {t('admin.refresh')}</button>
            </div>
            <div className="seg seg--wrap admin-tabs" role="tablist">
                {(['apps', 'reports', 'demand', 'partners'] as const).map((k) => (
                    <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'seg__on' : ''} onClick={() => setTab(k)}>
                        {t(('admin.tab.' + k) as TextKey)}
                        {k === 'reports' && reports.some((r) => r.kind === 'safety' && r.status !== 'done') ? ' 🛡' : ''}
                        {k === 'apps' ? ` (${apps.length})` : k === 'reports' ? ` (${reports.length})` : ''}
                    </button>
                ))}
            </div>

            {tab === 'apps' && (
                <div className="admin-list">
                    {apps.length === 0 && <p className="muted">{t('admin.empty')}</p>}
                    {apps.map((a) => (
                        <article key={a.id} className="card admin-app">
                            <p><strong>{a.id}</strong> · {a.roomId} · <span className="tag">{a.status}</span> · {a.consultLang === 'en' ? '🇬🇧 EN' : '한국어'} · {a.contactTime}</p>
                            <p className="muted">{a.moveInDate} · {a.months}m · {a.children.map((c) => c.ageBand + c.gender).join(', ')}</p>
                            {a.urgency && <p><span className={'tag' + (a.urgency === 'now' ? ' tag--danger' : '')}>{t(('apply.urgency.' + a.urgency) as TextKey)}</span></p>}
                            {a.situation && <p className="admin-situation">{a.situation}</p>}
                            <p>{a.document ? `📄 ${a.document.docType} ${a.document.checked ? '✓' : '⏳'}` : t('admin.noDoc')}</p>
                            <div className="btn-row btn-row--start">
                                {a.document && !a.document.checked && <button type="button" className="btn btn--outline btn--small" onClick={() => void poomApi.admin.checkDoc(a.id).then(load)}>{t('admin.docCheck')}</button>}
                                {a.status !== 'approved' && <button type="button" className="btn btn--primary btn--small" onClick={() => void decide(a.id, 'approve')}>{t('admin.approve')}</button>}
                                <button type="button" className="btn btn--ghost btn--small" onClick={() => void decide(a.id, 'hold')}>{t('admin.hold')}</button>
                                <button type="button" className="btn btn--ghost btn--small" onClick={() => void decide(a.id, 'reject')}>{t('admin.reject')}</button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {tab === 'reports' && (
                <div className="admin-list">
                    {reports.length === 0 && <p className="muted">{t('admin.empty')}</p>}
                    {reports.map((r) => <ReportItem key={r.id + r.status + r.replies.length} report={r} onSaved={() => void load()} />)}
                </div>
            )}

            {tab === 'demand' && (
                <div className="admin-list">
                    <p className="muted">{t('admin.demandHint')}</p>
                    {demand.length === 0 && <p className="muted">{t('admin.empty')}</p>}
                    <ul className="list">
                        {demand.map((d) => (
                            <li key={d.id} className="list__row">
                                <span className="list__main">{d.gu} · {d.householdSize}인 · {d.priceBand}</span>
                                <span className="demand-bar" style={{ inlineSize: Math.min(100, d.count * 20) + '%' }}>{d.count}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {tab === 'partners' && (
                <div className="admin-list">
                    {partners.length === 0 && <p className="muted">{t('admin.empty')}</p>}
                    {partners.map((p) => (
                        <article key={p.id} className="card">
                            <p><strong>{p.kind}</strong> · {p.gu} · {p.rooms} · {p.contact}</p>
                            <p className="muted">{p.message}</p>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
