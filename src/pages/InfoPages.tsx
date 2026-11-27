// 이용 안내 (SCR_GUIDE_01) · 없는 페이지
import { Link } from 'react-router-dom';
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
