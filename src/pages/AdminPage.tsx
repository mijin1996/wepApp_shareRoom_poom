// 운영 콘솔 (D09-ADMIN): 광고주 · 광고 확인 · 서류 확인 · 문의 통계 · 매출 · 혜택 · 제안 문의 · 신고함 · 공지 · 커뮤니티 · 지역 수요
import { Fragment, useCallback, useEffect, useState } from 'react';
import { getAdminKey, setAdminKey } from '../api/http';
import { poomApi } from '../api/poomApi';
import type { AdminQuestion, AdvertiserView, DemandView, DocumentView, InquiryStatsView, InquiryView, ListingView, NoticeDraft, NoticeView, PerkDraft, PerkView, ProposalView, ReportView, RevenueView } from '../api/types';
import { ErrorBox } from '../components/States';
import { useLang, type TextKey } from '../i18n/i18n';
import { won } from '../lib/format';
import { describe } from '../lib/trail';

const TABS = ['ads', 'docs', 'inquiries', 'revenue', 'perks', 'proposals', 'reports', 'notices', 'community', 'demand'] as const;
type Tab = typeof TABS[number];
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

const EMPTY_NOTICE: NoticeDraft = { category: 'service', titleKo: '', bodyKo: '', titleEn: '', bodyEn: '', pinned: false, published: true };
const NOTICE_CATEGORIES = ['service', 'house', 'event'] as const;

// 공지 쓰기 · 고치기 (한 양식으로). 지우기 대신 "내림" (POL_NOTICE_04)
function NoticeEditor({ notice, onSaved }: { notice?: NoticeView; onSaved: () => void })
{
    const { t } = useLang();
    const [draft, setDraft] = useState<NoticeDraft>(notice ?? EMPTY_NOTICE);
    const [error, setError] = useState<string | undefined>();
    const set = <K extends keyof NoticeDraft>(key: K, value: NoticeDraft[K]) => setDraft({ ...draft, [key]: value });

    const save = async () =>
    {
        const r = notice ? await poomApi.admin.updateNotice(notice.id, draft) : await poomApi.admin.createNotice(draft);
        setError(r.ok ? undefined : r.code);
        if (r.ok)
        {
            if (!notice)
            {
                setDraft(EMPTY_NOTICE);
            }
            onSaved();
        }
    };

    return (
        <div className="form">
            <label className="field"><span className="field__label">{t('admin.noticeCategory')}</span>
                <select className="input" value={draft.category} onChange={(e) => set('category', e.target.value as NoticeDraft['category'])}>
                    {NOTICE_CATEGORIES.map((c) => <option key={c} value={c}>{t(('notice.cat.' + c) as TextKey)}</option>)}
                </select></label>
            <label className="field"><span className="field__label">{t('admin.noticeTitleKo')}</span>
                <input className="input" value={draft.titleKo} maxLength={80} onChange={(e) => set('titleKo', e.target.value)} /></label>
            <label className="field"><span className="field__label">{t('admin.noticeBodyKo')}</span>
                <textarea className="input" rows={4} maxLength={3000} value={draft.bodyKo} onChange={(e) => set('bodyKo', e.target.value)} /></label>
            <label className="field"><span className="field__label">{t('admin.noticeTitleEn')}</span>
                <input className="input" value={draft.titleEn} maxLength={160} onChange={(e) => set('titleEn', e.target.value)} /></label>
            <label className="field"><span className="field__label">{t('admin.noticeBodyEn')}</span>
                <textarea className="input" rows={3} maxLength={6000} value={draft.bodyEn} onChange={(e) => set('bodyEn', e.target.value)} /></label>
            <label className="toggle"><input type="checkbox" checked={draft.pinned} onChange={(e) => set('pinned', e.target.checked)} /><span>📌 {t('admin.noticePin')}</span></label>
            <label className="toggle"><input type="checkbox" checked={draft.published} onChange={(e) => set('published', e.target.checked)} /><span>{t('admin.noticePublished')}</span></label>
            {error && <ErrorBox code={error} />}
            <button type="button" className="btn btn--primary btn--small" disabled={draft.titleKo.trim().length < 2 || draft.bodyKo.trim().length < 2} onClick={() => void save()}>{notice ? t('admin.noticeSave') : t('admin.noticeCreate')}</button>
        </div>
    );
}

// 커뮤니티 글 하나: 신고가 쌓인 글 · 답변 대기 글을 먼저 본다 (POL_COMMUNITY_05 · 06)
function CommunityItem({ question, onSaved }: { question: AdminQuestion; onSaved: () => void })
{
    const { t } = useLang();
    const [answer, setAnswer] = useState('');
    const [error, setError] = useState<string | undefined>();
    const waiting = !question.answers.some((a) => a.official && !a.hidden);

    const toggle = async (hidden: boolean, answerId?: string) =>
    {
        await poomApi.admin.setHidden(question.id, hidden, answerId);
        onSaved();
    };

    const send = async () =>
    {
        const r = await poomApi.admin.officialAnswer(question.id, answer);
        setError(r.ok ? undefined : r.code);
        if (r.ok)
        {
            setAnswer('');
            onSaved();
        }
    };

    return (
        <details className="card report">
            <summary className="report__summary">
                {question.hidden && <span className="tag tag--danger">{t('admin.hiddenTag')}</span>}
                {question.flaggedBy.length > 0 && <span className="tag">🚩 {t('admin.flags', { n: question.flaggedBy.length })}</span>}
                {waiting && <span className="tag tag--muted">{t('admin.waiting')}</span>}
                <span className="tag tag--muted">{question.topic}</span>
                <span className="report__msg">{question.title}</span>
                <span className="muted">{question.alias.role} {question.alias.tag} · {question.createdAt.slice(0, 16).replace('T', ' ')}</span>
            </summary>
            <div className="report__body">
                <p className="admin-situation">{question.body}</p>
                <div className="btn-row btn-row--start">
                    <button type="button" className="btn btn--outline btn--small" onClick={() => void toggle(!question.hidden)}>{question.hidden ? t('admin.unhide') : t('admin.hide')}</button>
                </div>
                <ul className="qa-answers">
                    {question.answers.map((a) => (
                        <li key={a.id} className={'card qa-answer' + (a.official ? ' qa-answer--official' : '')}>
                            <p className="qa-item__meta">
                                <strong>{a.official ? t('admin.officialAnswer') : a.alias.role + ' ' + a.alias.tag}</strong>
                                {a.hidden && <span className="tag tag--danger">{t('admin.hiddenTag')}</span>}
                                {a.flaggedBy.length > 0 && <span className="tag">🚩 {t('admin.flags', { n: a.flaggedBy.length })}</span>}
                            </p>
                            <p className="qa-answer__body">{a.body}</p>
                            <div className="btn-row btn-row--start">
                                <button type="button" className="btn btn--ghost btn--small" onClick={() => void toggle(!a.hidden, a.id)}>{a.hidden ? t('admin.unhide') : t('admin.hide')}</button>
                            </div>
                        </li>
                    ))}
                </ul>
                <label className="field">
                    <span className="field__label">{t('admin.officialAnswer')}</span>
                    <textarea className="input" rows={3} maxLength={1000} value={answer} onChange={(e) => setAnswer(e.target.value)} />
                </label>
                {error && <ErrorBox code={error} />}
                <button type="button" className="btn btn--primary btn--small" disabled={answer.trim().length < 2} onClick={() => void send()}>{t('admin.officialSend')}</button>
            </div>
        </details>
    );
}

const EMPTY_PERK: PerkDraft = { kind: 'partner', action: 'request', url: '', providerKo: '', providerEn: '', titleKo: '', titleEn: '', descKo: '', descEn: '', active: true };

function PerkEditor({ perk, onSaved }: { perk?: PerkView; onSaved: () => void })
{
    const { t } = useLang();
    const [draft, setDraft] = useState<PerkDraft>(perk ? { kind: perk.kind, action: perk.action, url: perk.url, providerKo: perk.providerKo, providerEn: perk.providerEn, titleKo: perk.titleKo, titleEn: perk.titleEn, descKo: perk.descKo, descEn: perk.descEn, active: perk.active } : EMPTY_PERK);
    const [error, setError] = useState<string | undefined>();
    const set = <K extends keyof PerkDraft>(k: K, v: PerkDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

    const save = async () =>
    {
        const r = perk ? await poomApi.admin.updatePerk(perk.id, draft) : await poomApi.admin.createPerk(draft);
        if (r.ok)
        {
            setError(undefined);
            if (!perk)
            {
                setDraft(EMPTY_PERK);
            }
            onSaved();
        }
        else
        {
            setError(r.code);
        }
    };

    return (
        <div className="form">
            <div className="seg seg--wrap">
                {(['partner', 'sponsor', 'institution'] as const).map((k) => (
                    <button type="button" key={k} className={draft.kind === k ? 'seg__on' : ''} aria-pressed={draft.kind === k} onClick={() => set('kind', k)}>{t(('perk.kind.' + k) as TextKey)}</button>
                ))}
            </div>
            <div className="seg seg--wrap">
                {(['request', 'link'] as const).map((k) => (
                    <button type="button" key={k} className={draft.action === k ? 'seg__on' : ''} aria-pressed={draft.action === k} onClick={() => set('action', k)}>{t(('admin.perkAction.' + k) as TextKey)}</button>
                ))}
            </div>
            {draft.action === 'link' && <input className="input" value={draft.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" />}
            <input className="input" value={draft.providerKo} onChange={(e) => set('providerKo', e.target.value)} placeholder={t('admin.perkProvider')} />
            <input className="input" value={draft.titleKo} onChange={(e) => set('titleKo', e.target.value)} placeholder={t('admin.noticeTitleKo')} maxLength={60} />
            <textarea className="input" rows={3} value={draft.descKo} onChange={(e) => set('descKo', e.target.value)} placeholder={t('admin.noticeBodyKo')} maxLength={1000} />
            <input className="input" value={draft.titleEn} onChange={(e) => set('titleEn', e.target.value)} placeholder={t('admin.noticeTitleEn')} maxLength={60} lang="en" />
            <textarea className="input" rows={2} value={draft.descEn} onChange={(e) => set('descEn', e.target.value)} placeholder={t('admin.noticeBodyEn')} maxLength={1000} lang="en" />
            <label className="toggle">
                <input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} />
                <span>{t('admin.perkActive')}</span>
            </label>
            {error && <ErrorBox code={error} />}
            <button type="button" className="btn btn--primary btn--small" onClick={() => void save()}>{t('admin.save')}</button>
        </div>
    );
}

export function AdminPage()
{
    const { t, lang } = useLang();
    const [key, setKey] = useState(getAdminKey());
    const [entered, setEntered] = useState(Boolean(getAdminKey()));
    const [tab, setTab] = useState<Tab>('ads');
    const [advertisers, setAdvertisers] = useState<AdvertiserView[]>([]);
    const [listings, setListings] = useState<ListingView[]>([]);
    const [documents, setDocuments] = useState<DocumentView[]>([]);
    const [inquiries, setInquiries] = useState<InquiryView[]>([]);
    const [stats, setStats] = useState<InquiryStatsView | undefined>();
    const [revenue, setRevenue] = useState<RevenueView[]>([]);
    const [perks, setPerks] = useState<{ perk: PerkView; requests: number }[]>([]);
    const [proposals, setProposals] = useState<ProposalView[]>([]);
    const [reports, setReports] = useState<ReportView[]>([]);
    const [demand, setDemand] = useState<DemandView[]>([]);
    const [community, setCommunity] = useState<AdminQuestion[]>([]);
    const [notices, setNotices] = useState<NoticeView[]>([]);
    const [rejectReason, setRejectReason] = useState('');
    const [error, setError] = useState<string | undefined>();

    const load = useCallback(async () =>
    {
        const [adv, lst, doc, inq, st, rev, pk, prp, r, d, q, n] = await Promise.all([
            poomApi.admin.advertisers(), poomApi.admin.listings(), poomApi.admin.documents(), poomApi.admin.inquiries(), poomApi.admin.stats(),
            poomApi.admin.revenue(), poomApi.admin.perks(), poomApi.admin.proposals(),
            poomApi.admin.reports(), poomApi.admin.demand(), poomApi.admin.community(), poomApi.admin.notices(),
        ]);
        if (!adv.ok)
        {
            setError(adv.code);
            setEntered(false);
            return;
        }
        setError(undefined);
        setAdvertisers(adv.data);
        setListings(lst.ok ? lst.data : []);
        setDocuments(doc.ok ? doc.data : []);
        setInquiries(inq.ok ? inq.data : []);
        setStats(st.ok ? st.data : undefined);
        setRevenue(rev.ok ? rev.data : []);
        setPerks(pk.ok ? pk.data : []);
        setProposals(prp.ok ? prp.data : []);
        setReports(r.ok ? r.data : []);
        setDemand(d.ok ? d.data : []);
        setNotices(n.ok ? n.data : []);
        // 신고 많은 글 → 답변 대기 글 → 최신 순
        const needsTeam = (x: AdminQuestion) => !x.answers.some((ans) => ans.official && !ans.hidden);
        const flags = (x: AdminQuestion) => x.flaggedBy.length + x.answers.reduce((sum, ans) => sum + ans.flaggedBy.length, 0);
        setCommunity(q.ok ? [...q.data].sort((x, y) => flags(y) - flags(x) || Number(needsTeam(y)) - Number(needsTeam(x))) : []);
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

    const run = (p: Promise<{ ok: boolean; code?: string }>) =>
    {
        void p.then(async (r) =>
        {
            setError(r.ok ? undefined : r.code);
            await load();
        });
    };

    const waiting: Record<Tab, number> = {
        ads: advertisers.filter((a) => a.status === 'pending').length + listings.filter((l) => l.status === 'review').length,
        docs: documents.filter((d) => !d.checked).length,
        inquiries: inquiries.length,
        revenue: 0,
        perks: 0,
        proposals: proposals.filter((p) => p.status === 'new').length,
        reports: reports.filter((r) => r.status !== 'done').length,
        notices: 0,
        community: community.length,
        demand: 0,
    };
    const totalPaid = revenue.reduce((s, r) => s + r.paid, 0);
    const totalUnpaid = revenue.reduce((s, r) => s + r.unpaid, 0);

    return (
        <div className="page page--admin">
            <div className="section__head">
                <h1>{t('admin.title')}</h1>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => void load()}>↻ {t('admin.refresh')}</button>
            </div>
            <div className="seg seg--wrap admin-tabs" role="tablist">
                {TABS.map((k) => (
                    <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'seg__on' : ''} onClick={() => setTab(k)}>
                        {t(('admin.tab.' + k) as TextKey)}
                        {k === 'reports' && reports.some((r) => r.kind === 'safety' && r.status !== 'done') ? ' 🛡' : ''}
                        {waiting[k] > 0 ? ` (${waiting[k]})` : ''}
                    </button>
                ))}
            </div>
            {error && <ErrorBox code={error} />}

            {tab === 'ads' && (
                <div className="admin-list">
                    <h2>{t('admin.advertisers')}</h2>
                    {advertisers.length === 0 && <p className="muted">{t('admin.empty')}</p>}
                    {advertisers.map((a) => (
                        <article key={a.id} className="card">
                            <p><span className="tag">{t(('ad.kind.' + a.kind) as TextKey)}</span> <strong>{a.nameKo}</strong> · <span className="tag tag--muted">{t(('admin.verify.' + a.status) as TextKey)}</span></p>
                            <p className="muted">{a.kind === 'agent' ? t('ad.regNo') + ' ' + a.agentRegNo : '📄 ' + t('ad.ownershipDoc') + (a.ownershipDoc ? ' ✓' : ' ✗')}{a.subscriptionUntil && ' · ' + t('ad.planUntil', { date: a.subscriptionUntil })}</p>
                            {a.status === 'pending' && (
                                <div className="btn-row btn-row--start">
                                    <button type="button" className="btn btn--primary btn--small" onClick={() => run(poomApi.admin.verifyAdvertiser(a.id, true))}>{t('admin.approve')}</button>
                                    <button type="button" className="btn btn--ghost btn--small" onClick={() => run(poomApi.admin.verifyAdvertiser(a.id, false))}>{t('admin.reject')}</button>
                                </div>
                            )}
                        </article>
                    ))}
                    <h2>{t('admin.listings')}</h2>
                    <p className="muted">{t('admin.listingHint')}</p>
                    {listings.length === 0 && <p className="muted">{t('admin.empty')}</p>}
                    {listings.map((l) => (
                        <article key={l.id} className="card">
                            <p><span className={'tag tag--listing-' + l.status}>{t(('ad.status.' + l.status) as TextKey)}</span> <strong>{l.draft.titleKo}</strong> · {l.advertiserId}</p>
                            <p className="muted">{t('card.bedrooms', { n: l.draft.bedrooms })} · {l.draft.privateM2}㎡ · {won(l.draft.deposit, lang)} / {won(l.draft.rent + l.draft.fee, lang)} · {l.draft.availableFrom}</p>
                            {l.draft.descriptionKo && <p className="admin-situation">{l.draft.descriptionKo}</p>}
                            <div className="btn-row btn-row--start">
                                {l.status === 'review' && (
                                    <>
                                        <button type="button" className="btn btn--primary btn--small" onClick={() => run(poomApi.admin.approveListing(l.id))}>{t('admin.approve')}</button>
                                        <input className="input input--inline" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t('admin.rejectReason')} />
                                        <button type="button" className="btn btn--ghost btn--small" disabled={rejectReason.trim().length < 2} onClick={() => run(poomApi.admin.rejectListing(l.id, rejectReason))}>{t('admin.reject')}</button>
                                    </>
                                )}
                                {(l.status === 'live' || l.status === 'approved') && (
                                    <button type="button" className="btn btn--ghost btn--small" onClick={() => run(poomApi.admin.endListing(l.id))}>{t('admin.forceEnd')}</button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {tab === 'docs' && (
                <div className="admin-list">
                    <p className="muted">{t('admin.docsHint')}</p>
                    {documents.length === 0 && <p className="muted">{t('admin.empty')}</p>}
                    {documents.map((d) => (
                        <article key={d.id + String(d.checked)} className="card">
                            <p>📄 {t(('doc.' + d.docType) as TextKey)} · {d.id} · {d.uploadedAt.slice(0, 16).replace('T', ' ')} {d.checked ? '✓' : '⏳'}</p>
                            {!d.checked && <button type="button" className="btn btn--outline btn--small" onClick={() => run(poomApi.admin.checkDoc(d.id))}>{t('admin.docCheck')}</button>}
                        </article>
                    ))}
                </div>
            )}

            {tab === 'inquiries' && (
                <div className="admin-list">
                    {stats && (
                        <div className="card">
                            <h2>{t('admin.statsTitle')}</h2>
                            <p className="muted">{t('admin.statsHint')}</p>
                            <dl className="kv">
                                <dt>{t('admin.statsTotal')}</dt><dd>{stats.total}</dd>
                                {(['sent', 'contacted', 'viewing', 'contracted', 'closed'] as const).map((s) => (
                                    <Fragment key={s}><dt>{t(('inquiry.status.' + s) as TextKey)}</dt><dd>{stats.byStatus[s]}</dd></Fragment>
                                ))}
                                <dt>🚨 {t('apply.urgency.now')}</dt><dd>{stats.urgentNow}</dd>
                                <dt>📄 {t('admin.statsDocs')}</dt><dd>{stats.docsChecked}</dd>
                            </dl>
                            <ul className="list">
                                {stats.byGu.map((g) => <li key={g.gu} className="list__row"><span className="list__main">{g.gu || '—'}</span><span>{g.count}</span></li>)}
                            </ul>
                        </div>
                    )}
                    {inquiries.map((q) => (
                        <article key={q.id} className="card admin-app">
                            <p><strong>{q.id}</strong> · {q.roomId} · <span className="tag">{t(('inquiry.status.' + q.status) as TextKey)}</span> · {q.advertiserId}</p>
                            <p className="muted">{q.moveInDate} · {q.months}m · {q.children.map((c) => c.ageBand + c.gender).join(', ')} {q.docShared ? '· 📄' : ''}</p>
                        </article>
                    ))}
                </div>
            )}

            {tab === 'revenue' && (
                <div className="admin-list">
                    <p className="muted">{t('admin.revenueHint')}</p>
                    <ul className="list">
                        {revenue.map((r) => (
                            <li key={r.productId} className="list__row">
                                <span className="list__main">{t(('ad.product.' + r.productId) as TextKey)} · {r.count}</span>
                                <span>{won(r.paid, lang)}{r.unpaid > 0 ? ` (+${won(r.unpaid, lang)} ⏳)` : ''}</span>
                            </li>
                        ))}
                        <li className="list__row"><strong className="list__main">{t('admin.revenueTotal')}</strong><strong>{won(totalPaid, lang)}{totalUnpaid > 0 ? ` (+${won(totalUnpaid, lang)} ⏳)` : ''}</strong></li>
                    </ul>
                </div>
            )}

            {tab === 'perks' && (
                <div className="admin-list">
                    <p className="muted">{t('admin.perksHint')}</p>
                    <details className="card report">
                        <summary className="report__summary"><strong>＋ {t('admin.perkNew')}</strong></summary>
                        <div className="report__body"><PerkEditor onSaved={() => void load()} /></div>
                    </details>
                    {perks.map(({ perk, requests }) => (
                        <details key={perk.id + perk.titleKo + String(perk.active)} className="card report">
                            <summary className="report__summary">
                                <span className={'tag tag--perk-' + perk.kind}>{t(('perk.kind.' + perk.kind) as TextKey)}</span>
                                {!perk.active && <span className="tag tag--danger">{t('admin.noticeDown')}</span>}
                                <span className="report__msg">{perk.titleKo}</span>
                                <span className="muted">{t('admin.perkUse', { clicks: perk.clicks, requests })}</span>
                            </summary>
                            <div className="report__body"><PerkEditor perk={perk} onSaved={() => void load()} /></div>
                        </details>
                    ))}
                </div>
            )}

            {tab === 'proposals' && (
                <div className="admin-list">
                    {proposals.length === 0 && <p className="muted">{t('admin.empty')}</p>}
                    {proposals.map((p) => (
                        <article key={p.id + p.status} className="card">
                            <p><span className="tag">{t(('contact.kind.' + p.kind) as TextKey)}</span> <strong>{p.org || p.name || '—'}</strong> · {p.contact} · {p.createdAt.slice(0, 10)}</p>
                            <p className="admin-situation">{p.message}</p>
                            <div className="seg seg--wrap">
                                {(['new', 'in_progress', 'done'] as const).map((s) => (
                                    <button type="button" key={s} className={p.status === s ? 'seg__on' : ''} aria-pressed={p.status === s} onClick={() => run(poomApi.admin.setProposalStatus(p.id, s))}>{t(('admin.proposal.' + s) as TextKey)}</button>
                                ))}
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

            {tab === 'notices' && (
                <div className="admin-list">
                    <details className="card report" open>
                        <summary className="report__summary"><strong>✏️ {t('admin.noticeNew')}</strong></summary>
                        <div className="report__body"><NoticeEditor onSaved={() => void load()} /></div>
                    </details>
                    {notices.map((n) => (
                        <details key={n.id + n.updatedAt} className="card report">
                            <summary className="report__summary">
                                {n.pinned && <span className="tag">📌</span>}
                                {!n.published && <span className="tag tag--danger">{t('admin.noticeDown')}</span>}
                                <span className="tag tag--muted">{t(('notice.cat.' + n.category) as TextKey)}</span>
                                <span className="report__msg">{n.titleKo}</span>
                                <span className="muted">{n.updatedAt.slice(0, 16).replace('T', ' ')}</span>
                            </summary>
                            <div className="report__body"><NoticeEditor notice={n} onSaved={() => void load()} /></div>
                        </details>
                    ))}
                </div>
            )}

            {tab === 'community' && (
                <div className="admin-list">
                    {community.length === 0 && <p className="muted">{t('admin.empty')}</p>}
                    {community.map((q) => <CommunityItem key={q.id + q.answers.length + String(q.hidden)} question={q} onSaved={() => void load()} />)}
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
        </div>
    );
}
