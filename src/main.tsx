import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { preferredLang } from './i18n/i18n';
import { installTrail } from './lib/trail';
import './styles/app.css';

// 저장소를 못 쓰는 환경(사생활 보호 창 · 아티팩트 미리보기)에서도 앱이 멈추지 않게 메모리 저장소로 대신한다
function ensureStorage(name: 'localStorage' | 'sessionStorage'): void
{
    try
    {
        window[name].setItem('poom.probe', '1');
        window[name].removeItem('poom.probe');
    }
    catch
    {
        const memory = new Map<string, string>();
        const fallback: Storage = {
            get length() { return memory.size; },
            clear: () => memory.clear(),
            getItem: (key) => memory.get(key) ?? null,
            key: (index) => Array.from(memory.keys())[index] ?? null,
            removeItem: (key) => { memory.delete(key); },
            setItem: (key, value) => { memory.set(key, String(value)); },
        };
        Object.defineProperty(window, name, { value: fallback, configurable: true });
    }
}
ensureStorage('localStorage');
ensureStorage('sessionStorage');

installTrail();

// 첫 방문: 기기 언어가 한국어가 아니면 영어 주소로 (SCR_LANG_01)
const lang = preferredLang();
if (!__IN_BROWSER_API__ && lang === 'en' && !location.pathname.startsWith('/en') && !localStorage.getItem('poom.visited'))
{
    history.replaceState(null, '', '/en' + (location.pathname === '/' ? '' : location.pathname) + location.search);
}
localStorage.setItem('poom.visited', '1');

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
