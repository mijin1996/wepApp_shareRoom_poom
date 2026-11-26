import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { preferredLang } from './i18n/i18n';
import { installTrail } from './lib/trail';
import './styles/app.css';

installTrail();

// 첫 방문: 기기 언어가 한국어가 아니면 영어 주소로 (SCR_LANG_01)
const lang = preferredLang();
if (lang === 'en' && !location.pathname.startsWith('/en') && !localStorage.getItem('poom.visited'))
{
    history.replaceState(null, '', '/en' + (location.pathname === '/' ? '' : location.pathname) + location.search);
}
localStorage.setItem('poom.visited', '1');

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
