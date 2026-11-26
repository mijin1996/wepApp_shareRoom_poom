// 방 상세 (SCR_ROOM_DETAIL_01): 비용 · 퇴실 청소비 · 면적 기준 · 주변 시설 · 규칙 · 가족 맞춤 신청
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { poomApi } from '../api/poomApi';
import type { RoomView } from '../api/types';
import { FamilyEditor } from '../components/FamilyEditor';
import { poiLabel } from '../components/RoomCard';
import { Sheet } from '../components/Sheet';
import { ErrorBox, Loading } from '../components/States';
import { useLang } from '../i18n/i18n';
import { shortDate, won } from '../lib/format';
import { useAppState } from '../state/appState';

export function RoomDetailPage()
{
    const { id = '' } = useParams();
    const { t, lang, path } = useLang();
    const navigate = useNavigate();
    const { user, children, setChildren, favorites, toggleFavorite } = useAppState();
    const [room, setRoom] = useState<RoomView | undefined>();
    const [error, setError] = useState<string | undefined>();
    const [familyOpen, setFamilyOpen] = useState(false);
    const [draft, setDraft] = useState(children);
    const [copied, setCopied] = useState(false);

    const load = () =>
    {
        setError(undefined);
        void poomApi.room(id, children).then((r) =>
        {
            if (r.ok)
            {
                setRoom(r.data);
            }
            else
            {
                setError(r.code);
            }
        });
    };
    useEffect(load, [id, children]);   // eslint-disable-line react-hooks/exhaustive-deps

    if (error)
    {
        return <div className="page"><ErrorBox code={error} onRetry={load} /></div>;
    }
    if (!room)
    {
        return <div className="page"><Loading /></div>;
    }

    const name = lang === 'en' ? room.houseNameEn : room.houseNameKo;
    const rules = lang === 'en' ? room.rulesEn : room.rulesKo;
    const fav = favorites.has(room.roomId);
    const features = [
        room.elevator && '🛗',
        room.noStairs && t('filter.noStairs'),
        room.playroom && t('filter.playroom'),
        room.parking && t('filter.parking'),
        room.foreignerOk && t('filter.foreignerOk'),
        room.englishStaff && t('filter.englishStaff'),
    ].filter(Boolean) as string[];

    const apply = () =>
    {
        if (!user)
        {
            navigate(path('/auth') + '?next=' + encodeURIComponent(path('/apply/' + room.roomId)));
            return;
        }
        navigate(path('/apply/' + room.roomId));
    };

    const share = async () =>
    {
        try
        {
            await navigator.clipboard.writeText(location.href);
            setCopied(true);
        }
        catch (err)
        {
            if (err instanceof DOMException)
            {
                setCopied(false);
                return;
            }
            throw err;
        }
    };

    let cta;
    if (room.status === 'occupied')
    {
        cta = <p className="cta-bar__msg">{t('detail.occupied')}</p>;
    }
    else if (room.fit === 'too_small')
    {
        cta = (
            <>
                <p className="cta-bar__msg cta-bar__msg--warn">{t('detail.tooSmall')}</p>
                <Link className="btn btn--primary" to={path('/rooms')}>{t('detail.seeFit')}</Link>
            </>
        );
    }
    else if (room.fit === 'household_too_large')
    {
        cta = (
            <>
                <p className="cta-bar__msg cta-bar__msg--warn">{t('family.tooLarge')}</p>
                <a className="btn btn--primary" href="tel:15774206">{t('detail.consult')}</a>
            </>
        );
    }
    else
    {
        cta = (
            <>
                <div className="cta-bar__price">
                    <strong>{t('card.monthly', { amount: won(room.monthly, lang) })}</strong>
                    <span className="muted">{t('card.deposit', { amount: won(room.deposit, lang) })}</span>
                </div>
                <button type="button" className="btn btn--primary" onClick={apply}>{t('detail.apply')}</button>
            </>
        );
    }

    return (
        <div className="page page--detail has-cta">
            <div className={'detail-hero photo--' + (room.houseId === 'h-bulgwang' ? 'leaf' : room.houseId === 'h-sillim' ? 'sky' : 'warm')} aria-hidden="true">
                <span>🏠</span>
            </div>
            <div className="detail-head">
                <div className="room-card__tags">
                    <span className={'tag tag--' + room.houseType}>{t(room.houseType === 'mom' ? 'card.mom' : 'card.dad')}</span>
                    <span className="tag tag--muted">{t('card.from', { date: shortDate(room.availableFrom, lang) })}</span>
                    {room.fit === 'fits' && <span className="tag tag--fit">✓ {t('card.fitOk')}</span>}
                </div>
                <h1>{name} · {t('card.bedrooms', { n: room.bedrooms })}</h1>
                <p className="muted">{lang === 'en' ? `${room.dongEn}, ${room.guEn}` : `${room.guKo} ${room.dongKo}`}</p>
                <div className="btn-row btn-row--start">
                    {user && (
                        <button type="button" className={'btn btn--outline btn--small' + (fav ? ' is-on' : '')} aria-pressed={fav} onClick={() => void toggleFavorite(room.roomId)}>
                            {fav ? '♥ ' + t('detail.favorited') : '♡ ' + t('detail.favorite')}
                        </button>
                    )}
                    <button type="button" className="btn btn--outline btn--small" onClick={() => void share()}>↗ {copied ? t('detail.copied') : t('detail.share')}</button>
                    {room.fit === 'unknown' && (
                        <button type="button" className="btn btn--outline btn--small" onClick={() =>
                        {
                            setDraft(children);
                            setFamilyOpen(true);
                        }}>👨‍👧 {t('detail.setFamily')}</button>
                    )}
                </div>
            </div>

            <div className="detail-grid">
                <section className="card detail-card">
                    <h2>{t('detail.cost')}</h2>
                    <dl className="kv">
                        <dt>{t('detail.deposit')}</dt><dd>{won(room.deposit, lang)}</dd>
                        <dt>{t('detail.rent')}</dt><dd>{won(room.rent, lang)}</dd>
                        <dt>{t('detail.fee')}</dt><dd>{won(room.fee, lang)}<small className="muted">{t('detail.feeIncludes')}</small></dd>
                        <dt className="kv__total">{t('detail.first')}</dt><dd className="kv__total">{won(room.firstPayment, lang)}</dd>
                        <dt>{t('detail.cleaning')}</dt><dd>{won(room.moveOutCleaningFee, lang)}</dd>
                        <dt>{t('detail.period')}</dt><dd>{t('detail.periodValue', { min: room.minMonths, max: room.maxMonths })}</dd>
                    </dl>
                </section>

                <section className="card detail-card">
                    <h2>{t('detail.room')}</h2>
                    <dl className="kv">
                        <dt>{t('detail.area')}</dt><dd>{room.areaM2}㎡</dd>
                        <dt>{t('detail.bath')}</dt><dd>{room.privateBath ? t('detail.privateBath') : t('detail.sharedBath')}</dd>
                    </dl>
                    <p className="notice">{t('detail.standard', { n: room.maxHousehold })}</p>
                    {features.length > 0 && (
                        <>
                            <h3>{t('detail.features')}</h3>
                            <ul className="tag-list">{features.map((f) => <li key={f} className="tag tag--muted">{f}</li>)}</ul>
                        </>
                    )}
                    <p className="muted">📹 {t('detail.tour')}</p>
                </section>

                <section className="card detail-card">
                    <h2>{t('detail.near')}</h2>
                    <ul className="poi-list">
                        {room.pois.map((p) => (
                            <li key={p.nameKo}>
                                <span className="tag">{poiLabel(t, p.kind)}</span>
                                <span className="poi-list__name">{lang === 'en' ? p.nameEn : p.nameKo}</span>
                                <span className="poi-list__min">🚶 {p.walkMin}′</span>
                            </li>
                        ))}
                    </ul>
                    <p className="muted">🔒 {t('detail.locationNote')}</p>
                </section>

                <section className="card detail-card">
                    <h2>{t('detail.rules')}</h2>
                    <ul className="rules">{rules.map((r) => <li key={r}>{r}</li>)}</ul>
                </section>
            </div>

            <div className="cta-bar">{cta}</div>

            <Sheet open={familyOpen} title={t('family.title')} onClose={() => setFamilyOpen(false)}
                footer={<button type="button" className="btn btn--primary btn--block" onClick={() =>
                {
                    setChildren(draft);
                    setFamilyOpen(false);
                }}>{t('family.done')}</button>}>
                <FamilyEditor value={draft} onChange={setDraft} />
            </Sheet>
        </div>
    );
}
