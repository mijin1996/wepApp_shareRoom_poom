// 앱 상태: 로그인 사용자 · 우리 가족 · 관심 방. 옵저버처럼 바뀌면 구독한 화면이 다시 그려진다
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { poomApi } from '../api/poomApi';
import { getToken, setToken } from '../api/http';
import type { ChildDraft, UserView } from '../api/types';

const FAMILY_KEY = 'poom.family';

interface IAppState
{
    readonly user: UserView | null;
    readonly ready: boolean;
    readonly children: readonly ChildDraft[];
    readonly favorites: ReadonlySet<string>;
    setChildren(children: readonly ChildDraft[]): void;
    signIn(token: string, user: UserView): void;
    signOut(): void;
    toggleFavorite(roomId: string): Promise<boolean>;
}

const AppStateContext = createContext<IAppState | undefined>(undefined);

function loadFamily(): ChildDraft[]
{
    try
    {
        const raw = localStorage.getItem(FAMILY_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? (parsed as ChildDraft[]) : [];
    }
    catch (error)
    {
        if (error instanceof SyntaxError)
        {
            return [];
        }
        throw error;
    }
}

export function AppStateProvider({ children: content }: { children: ReactNode })
{
    const [user, setUser] = useState<UserView | null>(null);
    const [ready, setReady] = useState(false);
    const [family, setFamily] = useState<readonly ChildDraft[]>(loadFamily);
    const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

    useEffect(() =>
    {
        if (!getToken())
        {
            setReady(true);
            return;
        }
        void (async () =>
        {
            const me = await poomApi.me();
            setUser(me.ok ? me.data : null);
            if (me.ok)
            {
                const favs = await poomApi.favorites();
                setFavorites(new Set(favs.ok ? favs.data : []));
            }
            setReady(true);
        })();
    }, []);

    const setChildren = useCallback((next: readonly ChildDraft[]) =>
    {
        setFamily(next);
        localStorage.setItem(FAMILY_KEY, JSON.stringify(next));
    }, []);

    const value = useMemo<IAppState>(() => ({
        user,
        ready,
        children: family,
        favorites,
        setChildren,
        signIn: (token, nextUser) =>
        {
            setToken(token);
            setUser(nextUser);
        },
        signOut: () =>
        {
            setToken(null);
            setUser(null);
            setFavorites(new Set());
        },
        toggleFavorite: async (roomId) =>
        {
            const result = await poomApi.toggleFavorite(roomId);
            if (!result.ok)
            {
                return false;
            }
            setFavorites((prev) =>
            {
                const next = new Set(prev);
                if (result.data.on)
                {
                    next.add(roomId);
                }
                else
                {
                    next.delete(roomId);
                }
                return next;
            });
            return true;
        },
    }), [user, ready, family, favorites, setChildren]);

    return <AppStateContext.Provider value={value}>{content}</AppStateContext.Provider>;
}

export function useAppState(): IAppState
{
    const ctx = useContext(AppStateContext);
    if (!ctx)
    {
        throw new Error('AppStateProvider 안에서만 쓸 수 있어요');
    }
    return ctx;
}
