// 간단 신청 3단계 (SCR_APPLY_01 ~ 03) + 서류 1장 (POL_HOUSE_02)
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { poomApi } from '../api/poomApi';
import type { DocType, RoomView } from '../api/types';
import { FamilyEditor } from '../components/FamilyEditor';
import { ErrorBox, Loading } from '../components/States';
import { useLang, type TextKey } from '../i18n/i18n';
import { todayIso, won } from '../lib/format';
import { useAppState } from '../state/appState';

const MONTH_OPTIONS = [1, 3, 6, 12, 24];

export function DocPicker({ value, onChange, idType }: { value: DocType | undefined; onChange: (d: DocType | undefined) => void; idType: 'kr' | 'alien' })
{
    const { t } = useLang();
    const [fileName, setFileName] = useState<string | undefined>();
    const options: readonly { id: DocType; key: TextKey }[] = idType === 'alien'
        ? [{ id: 'alien_reg', key: 'apply.docAlien' }]
        : [{ id: 'resident_reg', key: 'apply.docResident' }, { id: 'single_parent', key: 'apply.docSingle' }];
    return (
        <fieldset className="field doc-picker">
            <legend className="field__label">{t('apply.doc')}</legend>
            <p className="muted">{t('apply.docHelp')}</p>
            <div className="seg seg--wrap">
                {options.map((o) => (
                    <button type="button" key={o.id} className={value === o.id ? 'seg__on' : ''} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{t(o.key)}</button>
                ))}
            </div>
            {value && (
                <label className="btn btn--outline btn--block file-btn">
                    📷 {fileName ? t('apply.docPicked') + ' · ' + fileName : t('apply.docPick')}
                    <input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name)} />
                </label>
            )}
            {__APP_CHANNEL__ === 'test' && <p className="muted">🧪 {t('apply.docMockNote')}</p>}
        </fieldset>
    );
}

export function ApplyPage()
{
    const { roomId = '' } = useParams();
    const { t, lang, path } = useLang();
    const navigate = useNavigate();
    const { user, ready, children, setChildren } = useAppState();
    const [room, setRoom] = useState<RoomView | undefined>();
    const [step, setStep] = useState(1);
    const [moveIn, setMoveIn] = useState('');
    const [months, setMonths] = useState(3);
    const [family, setFamily] = useState(children);
    const [contact, setContact] = useState('afternoon');
    const [consultLang, setConsultLang] = useState<'ko' | 'en'>(lang);
    const [situation, setSituation] = useState('');
    const [urgency, setUrgency] = useState<'now' | 'week' | 'month' | undefined>();
    const [docType, setDocType] = useState<DocType | undefined>();
    const [later, setLater] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [busy, setBusy] = useState(false);

    useEffect(() =>
    {
        void poomApi.room(roomId, children).then((r) =>
        {
            if (r.ok)
            {
                setRoom(r.data);
                setMoveIn(r.data.availableFrom > todayIso() ? r.data.availableFrom : todayIso());
            }
            else
            {
                setError(r.code);
            }
        });
    }, [roomId]);   // eslint-disable-line react-hooks/exhaustive-deps

    if (ready && !user)
    {
        return <Navigate to={path('/auth') + '?next=' + encodeURIComponent(path('/apply/' + roomId))} replace />;
    }
    if (!room)
    {
        return <div className="page page--narrow">{error ? <ErrorBox code={error} /> : <Loading />}</div>;
    }

    const submit = async () =>
    {
        setBusy(true);
        setError(undefined);
        setChildren(family);
        const result = await poomApi.apply({
            roomId,
            moveInDate: moveIn,
            months,
            children: family.map((c) => c.ageBand + c.gender).join(','),
            contactTime: contact,
            consultLang,
            situation,
            urgency,
            docType: later ? undefined : docType,
        });
        setBusy(false);
        if (result.ok)
        {
            navigate(path('/apply/done') + (later || !docType ? '?doc=later' : ''));
        }
        else
        {
            setError(result.code);
        }
    };

    const canNext = step === 1 ? Boolean(moveIn) : step === 2 ? family.length > 0 : (later || Boolean(docType));

    return (
        <div className="page page--narrow has-cta">
            <p className="muted"><Link to={path('/rooms/' + roomId)}>← {lang === 'en' ? room.houseNameEn : room.houseNameKo}</Link> · {won(room.monthly, lang)}</p>
            <h1>{t('apply.title')}</h1>
            <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} aria-label={t('apply.step', { n: step })}>
                {[1, 2, 3].map((n) => <span key={n} className={'progress__dot' + (n <= step ? ' is-on' : '')} />)}
                <span className="progress__text">{t('apply.step', { n: step })}</span>
            </div>

            {step === 1 && (
                <div className="form">
                    <label className="field">
                        <span className="field__label">{t('apply.moveIn')}</span>
                        <input className="input" type="date" min={room.availableFrom > todayIso() ? room.availableFrom : todayIso()} value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
                    </label>
                    <fieldset className="field">
                        <legend className="field__label">{t('apply.months')}</legend>
                        <div className="seg seg--wrap">
                            {MONTH_OPTIONS.filter((m) => m >= room.minMonths && m <= room.maxMonths).map((m) => (
                                <button type="button" key={m} className={months === m ? 'seg__on' : ''} aria-pressed={months === m} onClick={() => setMonths(m)}>{t('apply.monthsValue', { n: m })}</button>
                            ))}
                        </div>
                    </fieldset>
                </div>
            )}

            {step === 2 && (
                <div className="form">
                    <p className="field__label">{t('apply.family')}</p>
                    <FamilyEditor value={family} onChange={setFamily} />
                </div>
            )}

            {step === 3 && (
                <div className="form">
                    <fieldset className="field">
                        <legend className="field__label">{t('apply.contact')}</legend>
                        <div className="seg seg--wrap">
                            {(['morning', 'afternoon', 'evening'] as const).map((c) => (
                                <button type="button" key={c} className={contact === c ? 'seg__on' : ''} aria-pressed={contact === c} onClick={() => setContact(c)}>{t(('apply.' + c) as TextKey)}</button>
                            ))}
                        </div>
                    </fieldset>
                    <fieldset className="field">
                        <legend className="field__label">{t('apply.lang')}</legend>
                        <div className="seg seg--wrap">
                            <button type="button" className={consultLang === 'ko' ? 'seg__on' : ''} aria-pressed={consultLang === 'ko'} onClick={() => setConsultLang('ko')}>한국어</button>
                            <button type="button" className={consultLang === 'en' ? 'seg__on' : ''} aria-pressed={consultLang === 'en'} onClick={() => setConsultLang('en')}>English</button>
                        </div>
                    </fieldset>
                    <fieldset className="field">
                        <legend className="field__label">{t('apply.urgency')}</legend>
                        <div className="seg seg--wrap">
                            {(['now', 'week', 'month'] as const).map((u) => (
                                <button type="button" key={u} className={urgency === u ? 'seg__on' : ''} aria-pressed={urgency === u} onClick={() => setUrgency(urgency === u ? undefined : u)}>{t(('apply.urgency.' + u) as TextKey)}</button>
                            ))}
                        </div>
                    </fieldset>
                    <label className="field">
                        <span className="field__label">{t('apply.situation')}</span>
                        <span className="muted" id="situation-help">{t('apply.situationHelp')}</span>
                        <textarea className="input" rows={6} maxLength={1000} value={situation} onChange={(e) => setSituation(e.target.value)} placeholder={t('apply.situationPlaceholder')} aria-describedby="situation-help situation-count" />
                        <span className="muted field__count" id="situation-count">🔒 {t('apply.situationPrivate')} · {situation.length} / 1000</span>
                    </label>
                    {!later && <DocPicker value={docType} onChange={setDocType} idType={user?.idType ?? 'kr'} />}
                    <label className="toggle">
                        <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} />
                        <span>{t('apply.docLater')}</span>
                    </label>
                    {later && <p className="notice">{t('apply.docLaterNote')}</p>}
                </div>
            )}

            {error && <ErrorBox code={error} />}

            <div className="cta-bar">
                {step > 1 && <button type="button" className="btn btn--ghost" onClick={() => setStep(step - 1)}>{t('apply.back')}</button>}
                {step < 3 && <button type="button" className="btn btn--primary" disabled={!canNext} onClick={() => setStep(step + 1)}>{t('apply.next')}</button>}
                {step === 3 && <button type="button" className="btn btn--primary" disabled={!canNext || busy} onClick={() => void submit()}>{t('apply.submit')}</button>}
            </div>
        </div>
    );
}

export function ApplyDonePage()
{
    const { t, path } = useLang();
    const hour = new Date().getHours();
    const night = hour < 9 || hour >= 21;
    const later = new URLSearchParams(location.search).get('doc') === 'later';
    return (
        <div className="page page--narrow">
            <div className="state state--empty">
                <span className="state__icon" aria-hidden="true">🎉</span>
                <h1 className="state__title">{t('apply.doneTitle')}</h1>
                <p>{night ? t('apply.doneNight') : t('apply.doneSub')}</p>
                {later && <p className="notice">{t('my.docNeeded')}</p>}
                <Link className="btn btn--primary" to={path('/my')}>{t('apply.goMy')}</Link>
            </div>
        </div>
    );
}
