// 광고 올리기 (SCR_AD_01 ~ 04): 광고 상품 · 광고주 등록 · 내 광고 · 받은 문의 · 결제 · 정산
// 품은 광고판 — 집 보여 주기 · 조건 · 계약 · 방값은 광고주와 한부모 가족이 직접 (POL_AD_01)
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { poomApi } from '../api/poomApi';
import { INQUIRY_STEPS, type AdProductView, type AdvertiserView, type ListingDraftView, type ListingView, type ProductId, type ReceivedInquiryView, type StatementView, type Suggestion } from '../api/types';
import { ErrorBox, Loading } from '../components/States';
import { useLang, type TextKey } from '../i18n/i18n';
import { shortDate, todayIso, won } from '../lib/format';
import { useAppState } from '../state/appState';
import { InquirySteps } from './MyPage';

type Tab = 'listings' | 'inquiries' | 'billing';

const EMPTY_DRAFT: ListingDraftView = {
    houseType: 'mom',
    placeId: '',
    titleKo: '',
    titleEn: '',
    buildingType: 'villa',
    bedrooms: 1,
    privateM2: 16,
    sharedM2: 0,
    households: 1,
    privateBath: false,
    deposit: 0,
    rent: 0,
    fee: 0,
    availableFrom: '',
    minMonths: 1,
    elevator: false,
    noStairs: false,
    parking: false,
    foreignerOk: false,
    descriptionKo: '',
    descriptionEn: '',
};

function ProductTable({ products }: { products: readonly AdProductView[] })
{
    const { t, lang } = useLang();
    return (
        <div className="ad-products">
            {products.map((p) => (
                <div key={p.id} className="card ad-product">
                    <span className="tag tag--muted">{t(('ad.for.' + p.forKind) as TextKey)}</span>
                    <p className="ad-product__name">{lang === 'en' ? p.nameEn : p.nameKo}</p>
                    <p className="price-big">{won(p.price, lang)}</p>
                    <p className="muted">{lang === 'en' ? p.descEn : p.descKo}</p>
                </div>
            ))}
        </div>
    );
}

function RegisterForm({ onDone }: { onDone: () => void })
{
    const { t } = useLang();
    const [kind, setKind] = useState<'agent' | 'owner'>('agent');
    const [nameKo, setNameKo] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [regNo, setRegNo] = useState('');
    const [ownDoc, setOwnDoc] = useState<string | undefined>();
    const [error, setError] = useState<string | undefined>();

    const submit = async (e: FormEvent) =>
    {
        e.preventDefault();
        const r = await poomApi.advertiser.register({ kind, nameKo, nameEn, agentRegNo: regNo, ownershipDoc: kind === 'owner' && Boolean(ownDoc) });
        if (r.ok)
        {
            onDone();
        }
        else
        {
            setError(r.code);
        }
    };

    return (
        <form className="form card" onSubmit={(e) => void submit(e)}>
            <h2>{t('ad.registerTitle')}</h2>
            <fieldset className="field">
                <legend className="field__label">{t('ad.kind')}</legend>
                <div className="seg seg--wrap">
                    {(['agent', 'owner'] as const).map((k) => (
                        <button type="button" key={k} className={kind === k ? 'seg__on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{t(('ad.kind.' + k) as TextKey)}</button>
                    ))}
                </div>
                <p className="muted">{t(kind === 'agent' ? 'ad.kindAgentNote' : 'ad.kindOwnerNote')}</p>
            </fieldset>
            <label className="field">
                <span className="field__label">{t(kind === 'agent' ? 'ad.officeName' : 'ad.ownerName')}</span>
                <input className="input" value={nameKo} onChange={(e) => setNameKo(e.target.value)} required minLength={2} maxLength={40} />
            </label>
            <label className="field">
                <span className="field__label">{t('ad.nameEn')}</span>
                <input className="input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={40} lang="en" />
            </label>
            {kind === 'agent' && (
                <label className="field">
                    <span className="field__label">{t('ad.regNo')}</span>
                    <input className="input" inputMode="numeric" value={regNo} onChange={(e) => setRegNo(e.target.value)} required placeholder="00000-0000-00000" />
                </label>
            )}
            {kind === 'owner' && (
                <label className="btn btn--outline btn--block file-btn">
                    📷 {ownDoc ? t('apply.docPicked') + ' · ' + ownDoc : t('ad.ownershipDoc')}
                    <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setOwnDoc(e.target.files?.[0]?.name)} />
                </label>
            )}
            {__APP_CHANNEL__ === 'test' && <p className="muted">🧪 {t('apply.docMockNote')}</p>}
            {error && <ErrorBox code={error} />}
            <button type="submit" className="btn btn--primary btn--block" disabled={kind === 'owner' && !ownDoc}>{t('ad.register')}</button>
        </form>
    );
}

function NumberField({ label, value, onChange, min = 0, max, step = 1 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number })
{
    return (
        <label className="field">
            <span className="field__label">{label}</span>
            <input className="input" type="number" inputMode="numeric" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} required />
        </label>
    );
}

function ListingForm({ onDone }: { onDone: () => void })
{
    const { t, lang } = useLang();
    const [draft, setDraft] = useState<ListingDraftView>({ ...EMPTY_DRAFT, availableFrom: todayIso() });
    const [areas, setAreas] = useState<Suggestion[]>([]);
    const [error, setError] = useState<string | undefined>();
    const set = <K extends keyof ListingDraftView>(key: K, value: ListingDraftView[K]) => setDraft((d) => ({ ...d, [key]: value }));

    useEffect(() =>
    {
        void poomApi.areas().then((r) => setAreas(r.ok ? r.data : []));
    }, []);

    const submit = async (e: FormEvent) =>
    {
        e.preventDefault();
        const r = await poomApi.advertiser.submit(draft);
        if (r.ok)
        {
            onDone();
        }
        else
        {
            setError(r.code);
        }
    };

    const toggles: readonly (keyof ListingDraftView)[] = ['privateBath', 'noStairs', 'elevator', 'parking', 'foreignerOk'];
    return (
        <form className="form card" onSubmit={(e) => void submit(e)}>
            <h3>{t('ad.newListing')}</h3>
            <fieldset className="field">
                <legend className="field__label">{t('ad.houseType')}</legend>
                <div className="seg seg--wrap">
                    {(['mom', 'dad'] as const).map((h) => (
                        <button type="button" key={h} className={draft.houseType === h ? 'seg__on' : ''} aria-pressed={draft.houseType === h} onClick={() => set('houseType', h)}>{t(h === 'mom' ? 'card.mom' : 'card.dad')}</button>
                    ))}
                </div>
            </fieldset>
            <label className="field">
                <span className="field__label">{t('ad.area')}</span>
                <select className="input" value={draft.placeId} onChange={(e) => set('placeId', e.target.value)} required>
                    <option value="">—</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.kind === 'dong' ? a.guKo + ' ' : ''}{lang === 'en' ? a.nameEn : a.nameKo}</option>)}
                </select>
            </label>
            <label className="field">
                <span className="field__label">{t('ad.listingTitle')}</span>
                <input className="input" value={draft.titleKo} onChange={(e) => set('titleKo', e.target.value)} required minLength={2} maxLength={40} />
            </label>
            <label className="field">
                <span className="field__label">{t('ad.titleEn')}</span>
                <input className="input" value={draft.titleEn} onChange={(e) => set('titleEn', e.target.value)} maxLength={40} lang="en" />
            </label>
            <label className="field">
                <span className="field__label">{t('ad.building')}</span>
                <select className="input" value={draft.buildingType} onChange={(e) => set('buildingType', e.target.value as ListingDraftView['buildingType'])}>
                    {(['house', 'villa', 'apartment', 'other'] as const).map((b) => <option key={b} value={b}>{t(('building.' + b) as TextKey)}</option>)}
                </select>
            </label>
            <div className="form-grid">
                <NumberField label={t('ad.bedrooms')} value={draft.bedrooms} min={1} max={4} onChange={(n) => set('bedrooms', n)} />
                <NumberField label={t('ad.privateM2')} value={draft.privateM2} min={5} max={200} onChange={(n) => set('privateM2', n)} />
                <NumberField label={t('ad.sharedM2')} value={draft.sharedM2} max={500} onChange={(n) => set('sharedM2', n)} />
                <NumberField label={t('ad.households')} value={draft.households} min={1} max={20} onChange={(n) => set('households', n)} />
                <NumberField label={t('ad.deposit')} value={draft.deposit} step={10000} onChange={(n) => set('deposit', n)} />
                <NumberField label={t('ad.rent')} value={draft.rent} step={10000} onChange={(n) => set('rent', n)} />
                <NumberField label={t('ad.fee')} value={draft.fee} step={10000} onChange={(n) => set('fee', n)} />
                <NumberField label={t('ad.minMonths')} value={draft.minMonths} min={1} max={24} onChange={(n) => set('minMonths', n)} />
            </div>
            <label className="field">
                <span className="field__label">{t('ad.availableFrom')}</span>
                <input className="input" type="date" value={draft.availableFrom} min={todayIso()} onChange={(e) => set('availableFrom', e.target.value)} required />
            </label>
            <div className="toggles">
                {toggles.map((key) => (
                    <label key={key} className="toggle">
                        <input type="checkbox" checked={Boolean(draft[key])} onChange={(e) => set(key, e.target.checked as never)} />
                        <span>{t(('ad.opt.' + key) as TextKey)}</span>
                    </label>
                ))}
            </div>
            <label className="field">
                <span className="field__label">{t('ad.description')}</span>
                <textarea className="input" rows={4} maxLength={1000} value={draft.descriptionKo} onChange={(e) => set('descriptionKo', e.target.value)} placeholder={t('ad.descriptionPh')} />
            </label>
            <p className="muted">🔒 {t('ad.addressNote')}</p>
            {error && <ErrorBox code={error} />}
            <button type="submit" className="btn btn--primary btn--block">{t('ad.submitListing')}</button>
        </form>
    );
}

function ListingRow({ listing, advertiser, products, onAct }: { listing: ListingView; advertiser: AdvertiserView; products: readonly AdProductView[]; onAct: (run: () => Promise<{ ok: boolean; code?: string }>) => void })
{
    const { t, lang, path } = useLang();
    const price = (id: ProductId) => won(products.find((p) => p.id === id)?.price ?? 0, lang);
    const live = listing.status === 'live';
    const featured = live && listing.topUntil !== '' && listing.topUntil >= todayIso();
    return (
        <li className="list__row list__row--stack">
            <span>
                <span className={'tag tag--listing-' + listing.status}>{t(('ad.status.' + listing.status) as TextKey)}</span>{' '}
                {featured && <span className="tag tag--fit">⭐ {t('ad.featured')}</span>}{' '}
                {live ? <Link to={path('/rooms/' + listing.roomId)}>{listing.draft.titleKo}</Link> : listing.draft.titleKo}
            </span>
            <span className="muted">
                {won(listing.draft.deposit, lang)} / {won(listing.draft.rent + listing.draft.fee, lang)}
                {live && listing.liveUntil && ' · ' + t('ad.liveUntil', { date: shortDate(listing.liveUntil, lang) })}
            </span>
            {listing.status === 'rejected' && <span className="notice notice--danger">{t('ad.rejected')}: {listing.rejectReason}</span>}
            {listing.status === 'approved' && advertiser.kind === 'agent' && <span className="notice">{t('ad.needPlan')}</span>}
            <div className="btn-row btn-row--start">
                {advertiser.kind === 'owner' && (listing.status === 'approved' || live) && (
                    <button type="button" className="btn btn--primary btn--small" onClick={() => onAct(() => poomApi.advertiser.buy('AD_OWNER_30D', listing.id, 'card'))}>
                        {t(live ? 'ad.extend30' : 'ad.pay30')} · {price('AD_OWNER_30D')}
                    </button>
                )}
                {live && (
                    <button type="button" className="btn btn--outline btn--small" onClick={() => onAct(() => poomApi.advertiser.buy('AD_TOP_7D', listing.id, 'card'))}>
                        ⭐ {t('ad.buyTop')} · {price('AD_TOP_7D')}
                    </button>
                )}
                {(live || listing.status === 'approved' || listing.status === 'review') && (
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => onAct(() => poomApi.advertiser.end(listing.id))}>{t('ad.end')}</button>
                )}
            </div>
        </li>
    );
}

function ReceivedRow({ row, onAct }: { row: ReceivedInquiryView; onAct: (run: () => Promise<{ ok: boolean; code?: string }>) => void })
{
    const { t, lang } = useLang();
    const q = row.inquiry;
    const next = INQUIRY_STEPS[INQUIRY_STEPS.indexOf(q.status) + 1];
    return (
        <li className="inquiry">
            <p className="inquiry__head">
                {q.urgency === 'now' && <span className="tag tag--danger">🚨 {t('apply.urgency.now')}</span>}{' '}
                <strong>{row.tenantName}</strong> · <a href={'tel:' + row.tenantPhone}>{row.tenantPhone}</a>
            </p>
            <p className="muted">
                {t('ad.children', { n: q.children.length })} · {shortDate(q.moveInDate, lang)} · {t('apply.monthsValue', { n: q.months })}
                {q.contactTime && ' · ' + t(('apply.' + q.contactTime) as TextKey)}
            </p>
            {q.situation && <p className="admin-situation">{q.situation}</p>}
            <p>
                {row.document
                    ? <span className={'tag ' + (row.document.checked ? 'tag--fit' : 'tag--muted')}>📄 {t(('doc.' + row.document.docType) as TextKey)}{row.document.checked ? ' · ✓ ' + t('ad.poomChecked') : ''}</span>
                    : <span className="tag tag--muted">📄 {t('ad.noDocYet')}</span>}
            </p>
            {q.status === 'closed' ? <p className="muted">{t('inquiry.status.closed')}</p> : <InquirySteps status={q.status} />}
            {q.status !== 'closed' && q.status !== 'contracted' && (
                <div className="btn-row btn-row--start">
                    {next && (
                        <button type="button" className="btn btn--primary btn--small" disabled={next === 'contracted' && !q.docShared}
                            onClick={() => onAct(() => poomApi.advertiser.setStatus(q.id, next))}>→ {t(('inquiry.status.' + next) as TextKey)}</button>
                    )}
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => onAct(() => poomApi.advertiser.setStatus(q.id, 'closed'))}>{t('ad.closeInquiry')}</button>
                </div>
            )}
        </li>
    );
}

export function AdvertisePage()
{
    const { t, lang, path } = useLang();
    const { user, ready } = useAppState();
    const [products, setProducts] = useState<AdProductView[]>([]);
    const [advertiser, setAdvertiser] = useState<AdvertiserView | null | undefined>();
    const [listings, setListings] = useState<ListingView[]>([]);
    const [received, setReceived] = useState<ReceivedInquiryView[]>([]);
    const [statement, setStatement] = useState<StatementView | undefined>();
    const [tab, setTab] = useState<Tab>('listings');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | undefined>();

    useEffect(() =>
    {
        void poomApi.adProducts().then((r) => setProducts(r.ok ? r.data : []));
    }, []);

    const load = useCallback(async () =>
    {
        const me = await poomApi.advertiser.me();
        if (!me.ok)
        {
            setError(me.code);
            return;
        }
        setAdvertiser(me.data.advertiser);
        if (me.data.advertiser?.status === 'verified')
        {
            const [l, q, s] = await Promise.all([poomApi.advertiser.listings(), poomApi.advertiser.inquiries(), poomApi.advertiser.statement()]);
            setListings(l.ok ? l.data : []);
            setReceived(q.ok ? q.data : []);
            setStatement(s.ok ? s.data : undefined);
        }
    }, []);

    useEffect(() =>
    {
        if (user)
        {
            void load();
        }
    }, [user, load]);

    const act = (run: () => Promise<{ ok: boolean; code?: string }>) =>
    {
        setError(undefined);
        void run().then(async (r) =>
        {
            if (!r.ok)
            {
                setError(r.code);
            }
            await load();
        });
    };

    const verified = advertiser?.status === 'verified' ? advertiser : undefined;
    const subscribed = verified?.kind === 'agent' && verified.subscriptionUntil !== '' && verified.subscriptionUntil >= todayIso();
    const planPrice = won(products.find((p) => p.id === 'AD_AGENT_MONTH')?.price ?? 0, lang);
    const newInquiries = received.filter((r) => r.inquiry.status === 'sent').length;

    return (
        <div className="page page--narrow">
            <h1>📣 {t('ad.title')}</h1>
            <p className="muted">{t('ad.sub')}</p>
            <ul className="ad-rules">
                <li>{t('ad.rule1')}</li>
                <li>{t('ad.rule2')}</li>
                <li>{t('ad.rule3')}</li>
            </ul>

            {!verified && (
                <>
                    <h2>{t('ad.products')}</h2>
                    <ProductTable products={products} />
                </>
            )}

            {error && <ErrorBox code={error} />}
            {!ready && <Loading />}
            {ready && !user && (
                <div className="state state--empty">
                    <p>{t('ad.loginFirst')}</p>
                    <Link className="btn btn--primary" to={path('/auth') + '?next=' + encodeURIComponent(path('/advertise'))}>{t('auth.submit')}</Link>
                </div>
            )}
            {user && advertiser === undefined && !error && <Loading />}
            {user && advertiser === null && <RegisterForm onDone={() => void load()} />}
            {advertiser?.status === 'pending' && <p className="notice" role="status">⏳ {t('ad.pending')}</p>}
            {advertiser?.status === 'rejected' && <p className="notice notice--danger" role="alert">{t('ad.rejectedAdvertiser')}</p>}

            {verified && (
                <>
                    <p className="notice notice--ok">✓ {t(('ad.kind.' + verified.kind) as TextKey)} · {verified.nameKo}{verified.agentRegNo && ' · ' + verified.agentRegNo}</p>
                    {verified.kind === 'agent' && (
                        <div className="card ad-plan">
                            <p>{subscribed ? t('ad.planUntil', { date: shortDate(verified.subscriptionUntil, lang) }) : t('ad.noPlan')}</p>
                            <button type="button" className="btn btn--primary btn--small" onClick={() => act(() => poomApi.advertiser.buy('AD_AGENT_MONTH', '', 'card'))}>
                                {t(subscribed ? 'ad.extendPlan' : 'ad.buyPlan')} · {planPrice}
                            </button>
                        </div>
                    )}
                    <div className="seg seg--wrap ad-tabs" role="tablist">
                        {(['listings', 'inquiries', 'billing'] as const).map((k) => (
                            <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'seg__on' : ''} onClick={() => setTab(k)}>
                                {t(('ad.tab.' + k) as TextKey)}{k === 'inquiries' && newInquiries > 0 ? ` (${newInquiries})` : ''}
                            </button>
                        ))}
                    </div>
                    {__APP_CHANNEL__ === 'test' && <p className="muted">🧪 {t('my.payMock')}</p>}

                    {tab === 'listings' && (
                        <section>
                            {adding
                                ? <ListingForm onDone={() => { setAdding(false); void load(); }} />
                                : <button type="button" className="btn btn--primary btn--block" onClick={() => setAdding(true)}>＋ {t('ad.newListing')}</button>}
                            {listings.length === 0 && !adding && <p className="muted">{t('ad.noListings')}</p>}
                            <ul className="list">
                                {listings.map((l) => <ListingRow key={l.id} listing={l} advertiser={verified} products={products} onAct={act} />)}
                            </ul>
                        </section>
                    )}

                    {tab === 'inquiries' && (
                        <section>
                            <p className="muted">🔒 {t('ad.inquiryPrivacy')}</p>
                            {received.length === 0 && <p className="muted">{t('ad.noInquiries')}</p>}
                            <ul className="inquiry-list">
                                {received.map((r) => <ReceivedRow key={r.inquiry.id} row={r} onAct={act} />)}
                            </ul>
                        </section>
                    )}

                    {tab === 'billing' && statement && (
                        <section>
                            <div className="card ad-plan">
                                <p>{t('ad.unpaid')}: <strong>{won(statement.unpaidTotal, lang)}</strong></p>
                                <button type="button" className="btn btn--primary btn--small" disabled={statement.unpaidTotal === 0} onClick={() => act(() => poomApi.advertiser.settle('card'))}>{t('ad.settle')}</button>
                            </div>
                            <p className="muted">{t('ad.leadNote')}</p>
                            <ul className="list">
                                {statement.charges.map((c) => (
                                    <li key={c.id} className="list__row">
                                        <span className="list__main">{t(('ad.product.' + c.productId) as TextKey)} · {shortDate(c.createdAt.slice(0, 10), lang)}</span>
                                        <span>{won(c.amount, lang)} {c.paid ? '✓' : '⏳'}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
