// 혜택 (SCR_PERK_01) · 문의 (SCR_CONTACT_01)
// 혜택: 제휴 업체 할인 · 기업 후원 · 기관 지원 — 한부모 가족은 0원 (POL_PERK)
// 문의: 광고 · 제휴 · 후원 · 기관 제안을 받는 창구 (POL_PROPOSAL)
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { poomApi } from '../api/poomApi';
import type { PerkKind, PerkView, ProposalKind } from '../api/types';
import { Empty, ErrorBox, Loading } from '../components/States';
import { useLang, type TextKey } from '../i18n/i18n';
import { useAppState } from '../state/appState';

const PERK_KINDS: readonly PerkKind[] = ['partner', 'sponsor', 'institution'];
const PROPOSAL_KINDS: readonly ProposalKind[] = ['ad', 'partner', 'sponsor', 'institution', 'etc'];

function PerkCard({ perk, requested, onRequested }: { perk: PerkView; requested: boolean; onRequested: () => void })
{
    const { t, lang, path } = useLang();
    const { user } = useAppState();
    const [note, setNote] = useState('');
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const en = lang === 'en' && perk.titleEn;

    const go = async () =>
    {
        const r = await poomApi.openPerk(perk.id);
        if (r.ok)
        {
            window.open(r.data.url, '_blank', 'noopener');
        }
        else
        {
            setError(r.code);
        }
    };

    const request = async (e: FormEvent) =>
    {
        e.preventDefault();
        const r = await poomApi.requestPerk(perk.id, note);
        if (r.ok)
        {
            setOpen(false);
            onRequested();
        }
        else
        {
            setError(r.code);
        }
    };

    return (
        <li className="card perk">
            <span className="qa-item__tags">
                <span className={'tag tag--perk-' + perk.kind}>{t(('perk.kind.' + perk.kind) as TextKey)}</span>
                {perk.example && <span className="tag tag--muted">{t('community.example')}</span>}
            </span>
            <p className="perk__title">{en ? perk.titleEn : perk.titleKo}</p>
            <p className="muted">{lang === 'en' ? perk.providerEn : perk.providerKo}</p>
            <p>{(lang === 'en' && perk.descEn) || perk.descKo}</p>
            {error && <ErrorBox code={error} />}
            {perk.action === 'link' && <button type="button" className="btn btn--outline btn--small" onClick={() => void go()}>{t('perk.go')} ↗</button>}
            {perk.action === 'request' && requested && <span className="tag tag--fit">✓ {t('perk.requested')}</span>}
            {perk.action === 'request' && !requested && !user && (
                <Link className="btn btn--outline btn--small" to={path('/auth') + '?next=' + encodeURIComponent(path('/perks'))}>{t('perk.loginToRequest')}</Link>
            )}
            {perk.action === 'request' && !requested && user && !open && (
                <button type="button" className="btn btn--primary btn--small" onClick={() => setOpen(true)}>{t('perk.request')}</button>
            )}
            {open && (
                <form className="form" onSubmit={(e) => void request(e)}>
                    <label className="field">
                        <span className="field__label">{t('perk.note')}</span>
                        <textarea className="input" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('perk.notePh')} />
                    </label>
                    <p className="muted">🔒 {t('perk.privacy')}</p>
                    <div className="btn-row btn-row--start">
                        <button type="submit" className="btn btn--primary btn--small">{t('perk.send')}</button>
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(false)}>{t('apply.back')}</button>
                    </div>
                </form>
            )}
        </li>
    );
}

export function PerksPage()
{
    const { t, path } = useLang();
    const { user } = useAppState();
    const [kind, setKind] = useState<PerkKind | ''>('');
    const [list, setList] = useState<PerkView[] | undefined>();
    const [mine, setMine] = useState<string[]>([]);
    const [error, setError] = useState<string | undefined>();

    const load = () =>
    {
        setError(undefined);
        void poomApi.perks(kind).then((r) =>
        {
            setError(r.ok ? undefined : r.code);
            setList(r.ok ? r.data : []);
        });
    };
    useEffect(load, [kind]);   // eslint-disable-line react-hooks/exhaustive-deps

    const loadMine = () =>
    {
        void poomApi.myPerkRequests().then((r) => setMine(r.ok ? r.data : []));
    };
    useEffect(() =>
    {
        if (user)
        {
            loadMine();
        }
    }, [user]);

    return (
        <div className="page page--narrow">
            <h1>🎁 {t('perk.title')}</h1>
            <p className="muted">{t('perk.sub')}</p>
            <div className="chips" role="group" aria-label={t('perk.title')}>
                <button type="button" className={'chip' + (kind === '' ? ' chip--on' : '')} aria-pressed={kind === ''} onClick={() => setKind('')}>{t('community.all')}</button>
                {PERK_KINDS.map((k) => (
                    <button type="button" key={k} className={'chip' + (kind === k ? ' chip--on' : '')} aria-pressed={kind === k} onClick={() => setKind(k)}>{t(('perk.kind.' + k) as TextKey)}</button>
                ))}
            </div>
            {error && <ErrorBox code={error} onRetry={load} />}
            {!list && !error && <Loading />}
            {list && list.length === 0 && !error && <Empty icon="🎁" title={t('perk.empty')} />}
            <ul className="qa-list">
                {(list ?? []).map((p) => <PerkCard key={p.id} perk={p} requested={mine.includes(p.id)} onRequested={loadMine} />)}
            </ul>
            <p className="perk-cta">
                {t('perk.offer')} <Link to={path('/contact')}>{t('nav.contact')} →</Link>
            </p>
        </div>
    );
}

export function ContactPage()
{
    const { t } = useLang();
    const initial = new URLSearchParams(location.search).get('kind') as ProposalKind | null;
    const [kind, setKind] = useState<ProposalKind>(initial && PROPOSAL_KINDS.includes(initial) ? initial : 'partner');
    const [org, setOrg] = useState('');
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [message, setMessage] = useState('');
    const [result, setResult] = useState<'sent' | string | undefined>();

    const submit = async (e: FormEvent) =>
    {
        e.preventDefault();
        const r = await poomApi.propose({ kind, org, name, contact, message });
        setResult(r.ok ? 'sent' : r.code);
    };

    return (
        <div className="page page--narrow">
            <h1>✉️ {t('contact.title')}</h1>
            <p className="muted">{t('contact.sub')}</p>
            <ul className="ad-rules">
                {PROPOSAL_KINDS.filter((k) => k !== 'etc').map((k) => <li key={k}><strong>{t(('contact.kind.' + k) as TextKey)}</strong> — {t(('contact.desc.' + k) as TextKey)}</li>)}
            </ul>
            {result === 'sent' ? <p className="notice notice--ok" role="status">✓ {t('contact.sent')}</p> : (
                <form className="form" onSubmit={(e) => void submit(e)}>
                    <fieldset className="field">
                        <legend className="field__label">{t('contact.kind')}</legend>
                        <div className="seg seg--wrap">
                            {PROPOSAL_KINDS.map((k) => (
                                <button type="button" key={k} className={kind === k ? 'seg__on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{t(('contact.kind.' + k) as TextKey)}</button>
                            ))}
                        </div>
                    </fieldset>
                    <label className="field">
                        <span className="field__label">{t('contact.org')}</span>
                        <input className="input" value={org} onChange={(e) => setOrg(e.target.value)} maxLength={60} />
                    </label>
                    <label className="field">
                        <span className="field__label">{t('contact.name')}</span>
                        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
                    </label>
                    <label className="field">
                        <span className="field__label">{t('contact.contact')}</span>
                        <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} required minLength={5} maxLength={80} placeholder={t('contact.contactPh')} />
                    </label>
                    <label className="field">
                        <span className="field__label">{t('contact.message')}</span>
                        <textarea className="input" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required minLength={5} maxLength={2000} />
                    </label>
                    {result && <ErrorBox code={result} />}
                    <button type="submit" className="btn btn--primary btn--block">{t('contact.send')}</button>
                </form>
            )}
        </div>
    );
}
