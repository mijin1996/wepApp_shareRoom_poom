// 틀: 위 머리글(넓은 화면 메뉴) · 아래 탭(휴대폰) · 떠 있는 버튼(긴급 도움 · 의견 신고) · 테스트판 표시
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import iconUrl from '../assets/icon.svg';
import { useLang } from '../i18n/i18n';
import { note } from '../lib/trail';
import { HelpSheet } from './HelpSheet';
import { captureScreenAsync, NO_SHOT_SCREENS, ReportSheet } from './ReportSheet';

// 경로 → 화면 ID (신고 · 3분 기록용)
export function screenIdOf(pathname: string): string
{
    const parts = pathname.replace(/^\/en(?=\/|$)/, '').split('/').filter(Boolean);
    if (parts.length === 0)
    {
        return 'home';
    }
    if (parts[0] === 'rooms')
    {
        return parts.length > 1 ? 'room' : 'rooms';
    }
    return parts[0];
}

export function Layout()
{
    const { t, lang, path } = useLang();
    const location = useLocation();
    const navigate = useNavigate();
    const [helpOpen, setHelpOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [shot, setShot] = useState<string | undefined>();
    const screenId = screenIdOf(location.pathname);

    useEffect(() =>
    {
        note('screen', screenId);
        window.scrollTo(0, 0);
    }, [location.pathname, screenId]);

    const switchLang = () =>
    {
        const rest = location.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
        navigate((lang === 'en' ? rest : (rest === '/' ? '/en' : '/en' + rest)) + location.search);
    };

    const openReport = async () =>
    {
        setShot(NO_SHOT_SCREENS.includes(screenId) ? undefined : await captureScreenAsync());
        setReportOpen(true);
    };

    // 위 메뉴(넓은 화면): 홈 · 방 찾기 · 내 집 · 혜택 · 공지 · 광고 올리기 · 문의 · 커뮤니티(맨 끝). 이용 안내는 홈 · 바닥글
    const menu = [
        { to: '/', label: t('nav.home'), end: true },
        { to: '/rooms', label: t('nav.rooms'), end: false },
        { to: '/my', label: t('nav.my'), end: false },
        { to: '/perks', label: t('nav.perks'), end: false },
        { to: '/notices', label: t('nav.notices'), end: false },
        { to: '/advertise', label: t('nav.advertise'), end: false },
        { to: '/contact', label: t('nav.contact'), end: false },
        { to: '/community', label: t('nav.community'), end: false },
    ];
    // 아래 탭(휴대폰): 5칸 — 홈 · 방 찾기 · 내 집 · 공지 · 커뮤니티(맨 끝). 이용 안내는 홈 · 바닥글에서
    const tabs = [
        { to: '/', icon: '🏠', label: t('nav.home'), end: true },
        { to: '/rooms', icon: '🔍', label: t('nav.rooms'), end: false },
        { to: '/my', icon: '🔑', label: t('nav.my'), end: false },
        { to: '/notices', icon: '📢', label: t('nav.notices'), end: false },
        { to: '/community', icon: '🙋', label: t('nav.community'), end: false },
    ];

    return (
        <div className="app">
            <a className="skip" href="#main">{lang === 'en' ? 'Skip to content' : '본문으로'}</a>
            <header className="topbar">
                <Link to={path('/')} className="brand" aria-label="품 Poom">
                    <img src={iconUrl} alt="" width={32} height={32} />
                    <span className="brand__name">품 <span className="brand__en">Poom</span></span>
                </Link>
                <nav className="topnav" aria-label={t('nav.home')}>
                    {menu.map((item) => (
                        <NavLink key={item.to} to={path(item.to)} end={item.end} className="topnav__link">{item.label}</NavLink>
                    ))}
                </nav>
                <div className="topbar__actions">
                    <button type="button" className="top-action top-action--icon top-action--help" onClick={() => setHelpOpen(true)} aria-label={t('help.button')} title={t('help.button')}>
                        <span aria-hidden="true">🆘</span>
                    </button>
                    <button type="button" className="top-action top-action--icon" onClick={() => void openReport()} aria-label={t('report.button')} title={t('report.button')}>
                        <span aria-hidden="true">💬</span>
                    </button>
                    <button type="button" className="top-action lang-btn" onClick={switchLang} lang={lang === 'en' ? 'ko' : 'en'}>
                        {t('nav.lang')}
                    </button>
                </div>
            </header>

            {__APP_CHANNEL__ === 'test' && (
                <div className="build-badge" aria-label={t('badge.test')}>{t('badge.test')} · v{__APP_VERSION__} · {__APP_BUILD_DATE__}</div>
            )}

            <main id="main" className="main">
                <Outlet />
            </main>

            <footer className="footer">
                <p><strong>품 Poom</strong> — {t('brand.tagline')}</p>
                <p className="muted">{t('brand.pronounce')}</p>
                <p className="footer__links">
                    <Link to={path('/guide')}>{t('nav.guide')}</Link>
                    <Link to={path('/notices')}>{t('nav.notices')}</Link>
                    <Link to={path('/community')}>{t('nav.community')}</Link>
                    <Link to={path('/perks')}>{t('nav.perks')}</Link>
                    <Link to={path('/advertise')}>{t('nav.advertise')}</Link>
                    <Link to={path('/contact')}>{t('nav.contact')}</Link>
                    <Link to={path('/admin')}>{t('nav.admin')}</Link>
                </p>
                <p className="muted footer__biz">상호 · 대표자 · 사업자등록번호 · 통신판매업 신고번호 — 사업자 등록 후 표시 (D13-LEGAL)</p>
            </footer>

            <nav className="tabbar" aria-label={t('nav.home')}>
                {tabs.map((tab) => (
                    <NavLink key={tab.to} to={path(tab.to)} end={tab.end} className="tabbar__item">
                        <span className="tabbar__icon" aria-hidden="true">{tab.icon}</span>
                        <span className="tabbar__label">{tab.label}</span>
                    </NavLink>
                ))}
            </nav>

            <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
            <ReportSheet open={reportOpen} screenId={screenId} shot={shot} onClose={() => setReportOpen(false)} />
        </div>
    );
}
