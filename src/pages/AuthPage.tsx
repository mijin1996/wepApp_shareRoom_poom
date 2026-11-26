// 본인인증 (SCR_AUTH_01) — Mock: 입력값으로 확인
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { poomApi } from '../api/poomApi';
import { useLang, type TextKey } from '../i18n/i18n';
import { useAppState } from '../state/appState';

export function AuthPage()
{
    const { t, lang, path } = useLang();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { signIn } = useAppState();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [gender, setGender] = useState<'f' | 'm'>('f');
    const [idType, setIdType] = useState<'kr' | 'alien'>('kr');
    const [error, setError] = useState<string | undefined>();
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) =>
    {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        const result = await poomApi.verify({ name, phone, gender, idType, lang });
        setBusy(false);
        if (!result.ok)
        {
            setError(result.code);
            return;
        }
        signIn(result.data.token, result.data.user);
        const next = params.get('next');
        navigate(next && next.startsWith('/') ? next : path('/my'));
    };

    return (
        <div className="page page--narrow">
            <h1>{t('auth.title')}</h1>
            <p className="muted">{t('auth.sub')}</p>
            {__APP_CHANNEL__ === 'test' && <p className="notice">🧪 {t('auth.mock')}</p>}
            <form className="form" onSubmit={(e) => void submit(e)}>
                <label className="field">
                    <span className="field__label">{t('auth.name')}</span>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} />
                </label>
                <label className="field">
                    <span className="field__label">{t('auth.phone')}</span>
                    <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" required />
                </label>
                <fieldset className="field">
                    <legend className="field__label">{t('auth.gender')}</legend>
                    <div className="seg seg--wrap">
                        <button type="button" className={gender === 'f' ? 'seg__on' : ''} aria-pressed={gender === 'f'} onClick={() => setGender('f')}>{t('auth.mom')}</button>
                        <button type="button" className={gender === 'm' ? 'seg__on' : ''} aria-pressed={gender === 'm'} onClick={() => setGender('m')}>{t('auth.dad')}</button>
                    </div>
                </fieldset>
                <fieldset className="field">
                    <legend className="field__label">{t('auth.idType')}</legend>
                    <div className="seg seg--wrap">
                        <button type="button" className={idType === 'kr' ? 'seg__on' : ''} aria-pressed={idType === 'kr'} onClick={() => setIdType('kr')}>{t('auth.kr')}</button>
                        <button type="button" className={idType === 'alien' ? 'seg__on' : ''} aria-pressed={idType === 'alien'} onClick={() => setIdType('alien')}>{t('auth.alien')}</button>
                    </div>
                </fieldset>
                {error && <p className="notice notice--danger" role="alert">{t(('error.' + error) as TextKey)}</p>}
                <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{t('auth.submit')}</button>
            </form>
        </div>
    );
}
