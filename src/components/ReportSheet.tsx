// 의견 · 신고 (SCR_REPORT_01): 화면 사진(선택) + 최근 3분 기록 + 기기 · 판 정보
import { useEffect, useState } from 'react';
import { poomApi } from '../api/poomApi';
import { useLang, type TextKey } from '../i18n/i18n';
import { hadRecentError, snapshot } from '../lib/trail';
import { useMeta } from '../lib/useMeta';
import { Sheet } from './Sheet';

// 개인정보가 보이는 화면은 사진을 찍지 않는다 (POL_REPORT_04)
export const NO_SHOT_SCREENS = ['my', 'auth', 'apply', 'admin'];
const MAX_SHOT_BYTES = 650 * 1024;
const MAX_SHOT_WIDTH = 900;
const CLIENT_KEY = 'poom.client';

function clientKey(): string
{
    let key = localStorage.getItem(CLIENT_KEY);
    if (!key)
    {
        key = crypto.randomUUID();
        localStorage.setItem(CLIENT_KEY, key);
    }
    return key;
}

// 버튼을 누른 그 순간의 화면을 JPEG 로 (보내기 전에 미리 보고 뺄 수 있음)
export async function captureScreenAsync(): Promise<string | undefined>
{
    try
    {
        const { default: html2canvas } = await import('html2canvas');
        const scale = Math.min(1, MAX_SHOT_WIDTH / window.innerWidth);
        const canvas = await html2canvas(document.body, {
            scale,
            width: window.innerWidth,
            height: window.innerHeight,
            x: window.scrollX,
            y: window.scrollY,
            logging: false,
            useCORS: true,
            ignoreElements: (el) => el.classList.contains('leaflet-tile'),
        });
        for (const quality of [0.7, 0.5, 0.35])
        {
            const url = canvas.toDataURL('image/jpeg', quality);
            if ((url.length * 3) / 4 <= MAX_SHOT_BYTES)
            {
                return url;
            }
        }
        return undefined;
    }
    catch (error)
    {
        console.warn('화면 사진 실패', error);
        return undefined;
    }
}

interface SpeechRecognitionLike
{
    lang: string;
    interimResults: boolean;
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onend: (() => void) | null;
    start(): void;
}

function speechCtor(): (new () => SpeechRecognitionLike) | undefined
{
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

interface ReportSheetProps
{
    readonly open: boolean;
    readonly screenId: string;
    readonly shot: string | undefined;
    readonly onClose: () => void;
}

export function ReportSheet({ open, screenId, shot, onClose }: ReportSheetProps)
{
    const { t, lang } = useLang();
    const meta = useMeta();
    const [kind, setKind] = useState('');
    const [message, setMessage] = useState('');
    const [useShot, setUseShot] = useState(true);
    const [listening, setListening] = useState(false);
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | string>('idle');

    useEffect(() =>
    {
        if (open)
        {
            setKind(hadRecentError() ? 'bug' : '');
            setMessage('');
            setUseShot(true);
            setStatus('idle');
        }
    }, [open]);

    const listen = () =>
    {
        const Ctor = speechCtor();
        if (!Ctor)
        {
            return;
        }
        const rec = new Ctor();
        rec.lang = lang === 'en' ? 'en-US' : 'ko-KR';
        rec.interimResults = false;
        rec.onresult = (e) =>
        {
            const text = Array.from(e.results).map((r) => r[0].transcript).join(' ');
            setMessage((m) => (m ? m + ' ' : '') + text);
        };
        rec.onend = () => setListening(false);
        setListening(true);
        rec.start();
    };

    const send = async () =>
    {
        setStatus('sending');
        const result = await poomApi.report({
            clientKey: clientKey(),
            kind,
            message,
            screenId,
            shot: useShot && shot && !NO_SHOT_SCREENS.includes(screenId) ? shot : undefined,
            trail: snapshot(),
            env: {
                width: String(window.innerWidth),
                height: String(window.innerHeight),
                dpr: String(window.devicePixelRatio),
                touch: String(navigator.maxTouchPoints > 0),
                ua: navigator.userAgent.slice(0, 120),
                path: location.pathname,
            },
            channel: __APP_CHANNEL__,
            version: __APP_VERSION__,
            lang,
        });
        setStatus(result.ok ? 'sent' : result.code);
    };

    const canShot = !NO_SHOT_SCREENS.includes(screenId);
    const sent = status === 'sent';

    return (
        <Sheet open={open} title={t('report.title')} onClose={onClose}
            footer={sent
                ? <button type="button" className="btn btn--primary btn--block" onClick={onClose}>{t('common.close')}</button>
                : <button type="button" className="btn btn--primary btn--block" disabled={!kind || !message.trim() || status === 'sending'} onClick={() => void send()}>{t('report.send')}</button>}>
            {sent ? (
                <p className="notice notice--ok" role="status">✓ {t('report.sent')}</p>
            ) : (
                <>
                    <fieldset className="field">
                        <legend className="field__label">{t('report.kind')}</legend>
                        <div className="kind-grid">
                            {(meta?.reportKinds ?? []).map((k) => (
                                <button type="button" key={k.id} className={'kind' + (kind === k.id ? ' kind--on' : '')} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                                    <span aria-hidden="true">{k.icon}</span>
                                    <span>{lang === 'en' ? k.name_en : k.name_ko}</span>
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    {kind === 'safety' && (
                        <div className="notice notice--danger" role="alert">
                            <p>{t('report.safetyWarn')}</p>
                            <a className="btn btn--danger btn--block" href="tel:112">📞 {t('report.call112')}</a>
                        </div>
                    )}
                    <label className="field">
                        <span className="field__label">{t('report.message')}</span>
                        <textarea className="input" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
                    </label>
                    {speechCtor() && (
                        <button type="button" className="btn btn--outline" onClick={listen} disabled={listening}>{listening ? t('report.listening') : t('report.voice')}</button>
                    )}
                    {canShot && shot && useShot && (
                        <figure className="shot">
                            <img src={shot} alt={t('report.shot')} />
                            <button type="button" className="btn btn--ghost btn--small" onClick={() => setUseShot(false)}>{t('report.removeShot')}</button>
                        </figure>
                    )}
                    {!canShot && <p className="muted">🔒 {t('report.noShot')}</p>}
                    <details className="attached">
                        <summary>{t('report.attached')}</summary>
                        <p className="muted">{t('report.attachedList')}</p>
                    </details>
                    {status !== 'idle' && status !== 'sending' && (
                        <p className="notice notice--danger" role="alert">{t(('error.' + status) as TextKey)}</p>
                    )}
                </>
            )}
        </Sheet>
    );
}
