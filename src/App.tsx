// 경로: 한국어는 /, 영어는 /en (POL_LANG_01)
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { LangProvider, type Lang } from './i18n/i18n';
import { AdminPage } from './pages/AdminPage';
import { ApplyDonePage, ApplyPage } from './pages/ApplyPage';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { GuidePage, NotFoundPage, PartnerPage } from './pages/InfoPages';
import { MyPage } from './pages/MyPage';
import { RoomDetailPage } from './pages/RoomDetailPage';
import { RoomsPage } from './pages/RoomsPage';
import { AppStateProvider } from './state/appState';
import { AskPage, CommunityPage, QuestionPage } from './pages/CommunityPages';
import { NoticePage, NoticesPage } from './pages/NoticePages';

// 아티팩트는 주소창 경로를 못 쓰므로 메모리 안에서만 화면을 옮긴다
const Router = __IN_BROWSER_API__ ? MemoryRouter : BrowserRouter;

function LangShell({ lang }: { lang: Lang })
{
    return (
        <LangProvider lang={lang}>
            <Routes>
                <Route element={<Layout />}>
                    <Route index element={<HomePage />} />
                    <Route path="rooms" element={<RoomsPage />} />
                    <Route path="rooms/:id" element={<RoomDetailPage />} />
                    <Route path="auth" element={<AuthPage />} />
                    <Route path="apply/done" element={<ApplyDonePage />} />
                    <Route path="apply/:roomId" element={<ApplyPage />} />
                    <Route path="my" element={<MyPage />} />
                    <Route path="notices" element={<NoticesPage />} />
                    <Route path="notices/:id" element={<NoticePage />} />
                    <Route path="community" element={<CommunityPage />} />
                    <Route path="community/ask" element={<AskPage />} />
                    <Route path="community/:id" element={<QuestionPage />} />
                    <Route path="guide" element={<GuidePage />} />
                    <Route path="partner" element={<PartnerPage />} />
                    <Route path="admin" element={<AdminPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Route>
            </Routes>
        </LangProvider>
    );
}

export function App()
{
    return (
        <Router>
            <AppStateProvider>
                <Routes>
                    <Route path="/en/*" element={<LangShell lang="en" />} />
                    <Route path="/*" element={<LangShell lang="ko" />} />
                </Routes>
            </AppStateProvider>
        </Router>
    );
}
