// 한국어 · 영어 (POL_LANG_01): 문구는 코드에 쓰지 않고 키로만 부른다
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import ko from './ko.json';
import en from './en.json';

export type Lang = 'ko' | 'en';
export type TextKey = keyof typeof ko;

const DICTS: Readonly<Record<Lang, Readonly<Record<string, string>>>> = { ko, en };

export function translate(lang: Lang, key: TextKey, vars?: Readonly<Record<string, string | number>>): string
{
    let text = DICTS[lang][key] ?? DICTS.ko[key] ?? key;
    for (const [name, value] of Object.entries(vars ?? {}))
    {
        text = text.split(`{${name}}`).join(String(value));
    }
    return text;
}

interface ILangContext
{
    readonly lang: Lang;
    readonly t: (key: TextKey, vars?: Readonly<Record<string, string | number>>) => string;
    readonly path: (to: string) => string;      // 영어는 /en 경로
}

const LangContext = createContext<ILangContext | undefined>(undefined);

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode })
{
    useEffect(() =>
    {
        document.documentElement.lang = lang;
        localStorage.setItem('poom.lang', lang);
    }, [lang]);

    const value: ILangContext = {
        lang,
        t: (key, vars) => translate(lang, key, vars),
        path: (to) => (lang === 'en' ? (to === '/' ? '/en' : '/en' + to) : to),
    };
    return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): ILangContext
{
    const ctx = useContext(LangContext);
    if (!ctx)
    {
        throw new Error('LangProvider 안에서만 쓸 수 있어요');
    }
    return ctx;
}

// 첫 방문: 기기 언어가 한국어가 아니면 영어 (SCR_LANG_01)
export function preferredLang(): Lang
{
    const saved = localStorage.getItem('poom.lang');
    if (saved === 'ko' || saved === 'en')
    {
        return saved;
    }
    return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}
