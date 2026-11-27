// 방 카드 (SCR_ROOM_LIST_01 [2])
import { Link } from 'react-router-dom';
import type { RoomView } from '../api/types';
import { useLang, type TextKey } from '../i18n/i18n';
import { isToday, shortDate, won } from '../lib/format';
import { useAppState } from '../state/appState';

const HOUSE_COLORS: Readonly<Record<string, string>> = { 'h-mangwon': 'warm', 'h-bulgwang': 'leaf', 'h-sillim': 'sky' };

export function RoomCard({ room }: { room: RoomView })
{
    const { t, lang, path } = useLang();
    const { user, favorites, toggleFavorite } = useAppState();
    const firstPoi = room.pois[0];
    const fav = favorites.has(room.roomId);

    return (
        <article className="card room-card">
            <Link to={path('/rooms/' + room.roomId)} className="room-card__link">
                <div className={'room-card__photo photo--' + (HOUSE_COLORS[room.houseId] ?? 'warm')} aria-hidden="true">
                    <span className="room-card__photo-icon">🏠</span>
                    <span className="room-card__beds">{t('card.bedrooms', { n: room.bedrooms })}</span>
                </div>
                <div className="room-card__body">
                    <div className="room-card__tags">
                        <span className={'tag tag--' + room.houseType}>{t(room.houseType === 'mom' ? 'card.mom' : 'card.dad')}</span>
                        {room.status === 'held' && <span className="tag tag--muted">{t('card.held')}</span>}
                        {room.status === 'vacant' && (
                            <span className={'tag ' + (room.availableSoon ? 'tag--now' : 'tag--muted')}>
                                {isToday(room.availableFrom) ? t('card.today') : t('card.from', { date: shortDate(room.availableFrom, lang) })}
                            </span>
                        )}
                        {room.fit === 'fits' && <span className="tag tag--fit">✓ {t('card.fitOk')}</span>}
                        {room.featured && <span className="tag tag--featured">⭐ {t('ad.featured')}</span>}
                    </div>
                    <h3 className="room-card__title">{lang === 'en' ? room.houseNameEn : room.houseNameKo}</h3>
                    <p className="room-card__where">{lang === 'en' ? [room.dongEn, room.guEn].filter(Boolean).join(', ') : [room.guKo, room.dongKo].filter(Boolean).join(' ')}</p>
                    <p className="room-card__by muted">{t(room.listedBy === 'agent' ? 'ad.byAgent' : 'ad.byOwner')} · {lang === 'en' ? room.advertiserNameEn : room.advertiserNameKo}</p>
                    <p className="room-card__price">
                        <strong>{t('card.monthly', { amount: won(room.monthly, lang) })}</strong>
                        <span className="muted">{t('card.deposit', { amount: won(room.deposit, lang) })}</span>
                    </p>
                    <p className="room-card__meta">
                        <span>{t('card.upTo', { n: room.maxHousehold })}</span>
                        {firstPoi && <span>{t('card.walk', { place: lang === 'en' ? firstPoi.nameEn : firstPoi.nameKo, min: firstPoi.walkMin })}</span>}
                        {room.placeWalkMin !== undefined && <span>🚶 {room.placeWalkMin}′</span>}
                    </p>
                </div>
            </Link>
            {user && (
                <button type="button" className={'fav-btn' + (fav ? ' fav-btn--on' : '')} aria-pressed={fav}
                    aria-label={t(fav ? 'detail.favorited' : 'detail.favorite')} onClick={() => void toggleFavorite(room.roomId)}>
                    {fav ? '♥' : '♡'}
                </button>
            )}
        </article>
    );
}

export function poiLabel(t: (k: TextKey) => string, kind: string): string
{
    return t(('poi.' + kind) as TextKey);
}
