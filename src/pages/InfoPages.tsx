// 이용 안내 (SCR_GUIDE_01) · 집 빌려주실 분 (SCR_PARTNER_01) · 없는 페이지
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { poomApi } from '../api/poomApi';
import { useLang, type TextKey } from '../i18n/i18n';
import { useMeta } from '../lib/useMeta';

export function GuidePage()
{
    const { t, lang } = useLang();
    const meta = useMeta();
    return (
        <div className="page page--narrow">
            <h1>{t('guide.title')}</h1>
            <h2>{t('guide.steps')}</h2>
            <ol className="steps">
                {(['1', '2', '3', '4', '5'] as const).map((n) => (
                    <li key={n} className="step">
                        <span className="step__num">{n}</span>
                        <p className="step__title">{t(('guide.s' + n) as TextKey)}</p>
                    </li>
                ))}
            </ol>
            <h2>{t('guide.faq')}</h2>
            <div className="faq">
                {(meta?.faq ?? []).map((item) => (
                    <details key={item.q_ko} className="faq__item">
                        <summary>{lang === 'en' ? item.q_en : item.q_ko}</summary>
                        <p>{lang === 'en' ? item.a_en : item.a_ko}</p>
                    </details>
                ))}
            </div>
        </div>
    );
}

export function PartnerPage()
{
    const { t } = useLang();
    const [kind, setKind] = useState<'owner' | 'building' | 'org'>('owner');
    const [gu, setGu] = useState('');
    const [rooms, setRooms] = useState('3');
    const [contact, setContact] = useState('');
    const [message, setMessage] = useState('');
    const [result, setResult] = useState<'sent' | string | undefined>();

    const submit = async (e: FormEvent) =>
    {
        e.preventDefault();
        const r = await poomApi.partner({ kind, gu, rooms: Number(rooms), contact, message });
        setResult(r.ok ? 'sent' : r.code);
    };

    return (
        <div className="page page--narrow">
            <h1>🤝 {t('partner.title')}</h1>
            <p className="muted">{t('partner.sub')}</p>
            {result === 'sent' ? <p className="notice notice--ok" role="status">✓ {t('partner.sent')}</p> : (
                <form className="form" onSubmit={(e) => void submit(e)}>
                    <fieldset className="field">
                        <legend className="field__label">{t('partner.kind')}</legend>
                        <div className="seg seg--wrap">
                            {(['owner', 'building', 'org'] as const).map((k) => (
                                <button type="button" key={k} className={kind === k ? 'seg__on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{t(('partner.' + k) as TextKey)}</button>
                            ))}
                        </div>
                    </fieldset>
                    <label className="field">
                        <span className="field__label">{t('partner.gu')}</span>
                        <input className="input" value={gu} onChange={(e) => setGu(e.target.value)} required />
                    </label>
                    <label className="field">
                        <span className="field__label">{t('partner.rooms')}</span>
                        <input className="input" type="number" min={1} max={50} value={rooms} onChange={(e) => setRooms(e.target.value)} required />
                    </label>
                    <label className="field">
                        <span className="field__label">{t('partner.contact')}</span>
                        <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} required minLength={5} />
                    </label>
                    <label className="field">
                        <span className="field__label">{t('partner.message')}</span>
                        <textarea className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
                    </label>
                    {result && <p className="notice notice--danger" role="alert">{t(('error.' + result) as TextKey)}</p>}
                    <button type="submit" className="btn btn--primary btn--block">{t('partner.send')}</button>
                </form>
            )}
        </div>
    );
}

export function NotFoundPage()
{
    const { t, path } = useLang();
    return (
        <div className="page page--narrow">
            <div className="state state--empty">
                <span className="state__icon" aria-hidden="true">🧭</span>
                <p className="state__title">{t('common.notFound')}</p>
                <Link className="btn btn--primary" to={path('/')}>{t('common.goHome')}</Link>
            </div>
        </div>
    );
}
