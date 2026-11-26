// 공통 상태 화면: Loading · Error · Empty (D05 §4)
import { useEffect, useState, type ReactNode } from 'react';
import { useLang, type TextKey } from '../i18n/i18n';

const SLOW_MS = 10000;

export function Loading()
{
    const { t } = useLang();
    const [slow, setSlow] = useState(false);
    useEffect(() =>
    {
        const timer = setTimeout(() => setSlow(true), SLOW_MS);
        return () => clearTimeout(timer);
    }, []);
    return (
        <div className="state" role="status" aria-live="polite">
            <div className="skeleton" />
            <div className="skeleton skeleton--short" />
            <p className="muted">{slow ? t('common.slow') : t('common.loading')}</p>
        </div>
    );
}

export function ErrorBox({ code, onRetry }: { code: string; onRetry?: () => void })
{
    const { t } = useLang();
    return (
        <div className="state notice notice--danger" role="alert">
            <p>{t(('error.' + code) as TextKey) || t('common.error')}</p>
            {onRetry && <button type="button" className="btn btn--outline" onClick={onRetry}>{t('common.retry')}</button>}
        </div>
    );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode })
{
    return (
        <div className="state state--empty">
            <span className="state__icon" aria-hidden="true">{icon}</span>
            <p className="state__title">{title}</p>
            {children}
        </div>
    );
}
