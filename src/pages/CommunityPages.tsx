// 커뮤니티 묻고 답하기 (SCR_COMMUNITY_01 ~ 03): 목록 · 글 · 질문하기
// 읽기는 누구나, 쓰기는 본인인증 회원만. 실명 대신 "엄마 · 아빠 + 4글자"로만 보인다 (POL_COMMUNITY_02)
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { poomApi } from '../api/poomApi';
import type { CommunityAlias, CommunityTopic, QuestionDetail, QuestionSummaryView } from '../api/types';
import { Empty, ErrorBox, Loading } from '../components/States';
import { useLang, type TextKey } from '../i18n/i18n';
import { shortDate } from '../lib/format';
import { useAppState } from '../state/appState';

export const TOPICS: readonly CommunityTopic[] = ['movein', 'life', 'kids', 'support', 'etc'];
const TITLE_MAX = 80;
const TEXT_MAX = 1000;

function AliasBadge({ alias }: { alias: CommunityAlias })
{
    const { t } = useLang();
    return (
        <span className={'alias alias--' + alias.role}>
            {alias.role === 'team' ? '🏠 ' : ''}{t(('community.role.' + alias.role) as TextKey)}{alias.tag ? ' · ' + alias.tag : ''}
        </span>
    );
}

// 글쓰기 전에 본인인증으로 보내는 안내
function LoginToWrite({ next }: { next: string })
{
    const { t, path } = useLang();
    return (
        <div className="notice">
            <p>{t('community.loginToWrite')}</p>
            <Link className="btn btn--outline btn--block" to={path('/auth') + '?next=' + encodeURIComponent(path(next))}>{t('community.loginBtn')}</Link>
        </div>
    );
}

export function CommunityPage()
{
    const { t, lang, path } = useLang();
    const [topic, setTopic] = useState<CommunityTopic | ''>('');
    const [query, setQuery] = useState('');
    const [list, setList] = useState<QuestionSummaryView[] | undefined>();
    const [error, setError] = useState<string | undefined>();

    const load = useCallback(async () =>
    {
        const r = await poomApi.community.list(topic, query.trim());
        setError(r.ok ? undefined : r.code);
        setList(r.ok ? r.data : []);
    }, [topic, query]);

    useEffect(() =>
    {
        const timer = setTimeout(() => void load(), 250);
        return () => clearTimeout(timer);
    }, [load]);

    return (
        <div className="page page--narrow">
            <div className="section__head">
                <h1>🙋 {t('community.title')}</h1>
                <Link className="btn btn--primary btn--small" to={path('/community/ask')}>✏️ {t('community.ask')}</Link>
            </div>
            <p className="muted">{t('community.sub')}</p>

            <label className="field">
                <span className="sr-only">{t('community.search')}</span>
                <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={'🔍 ' + t('community.search')} />
            </label>
            <div className="chips" role="group" aria-label={t('community.formTopic')}>
                <button type="button" className={'chip' + (topic === '' ? ' chip--on' : '')} aria-pressed={topic === ''} onClick={() => setTopic('')}>{t('community.all')}</button>
                {TOPICS.map((k) => (
                    <button type="button" key={k} className={'chip' + (topic === k ? ' chip--on' : '')} aria-pressed={topic === k} onClick={() => setTopic(k)}>{t(('community.topic.' + k) as TextKey)}</button>
                ))}
            </div>

            {error && <ErrorBox code={error} onRetry={() => void load()} />}
            {!list && !error && <Loading />}
            {list && list.length === 0 && !error && (
                <Empty icon="🙋" title={t('community.empty')}>
                    <Link className="btn btn--outline" to={path('/community/ask')}>{t('community.ask')}</Link>
                </Empty>
            )}
            <ul className="qa-list">
                {(list ?? []).map((q) => (
                    <li key={q.id}>
                        <Link className="card qa-item" to={path('/community/' + q.id)}>
                            <span className="qa-item__tags">
                                <span className="tag tag--muted">{t(('community.topic.' + q.topic) as TextKey)}</span>
                                {q.solved && <span className="tag tag--fit">✓ {t('community.solved')}</span>}
                                {q.hasOfficial && <span className="tag">🏠 {t('community.official')}</span>}
                                {q.example && <span className="tag tag--muted">{t('community.example')}</span>}
                            </span>
                            <span className="qa-item__title" lang={q.lang}>{q.title}</span>
                            <span className="qa-item__meta muted">
                                <AliasBadge alias={q.alias} /> · {shortDate(q.createdAt, lang)} · 💬 {t('community.answers', { n: q.answerCount })}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function QuestionPage()
{
    const { id = '' } = useParams();
    const { t, lang, path } = useLang();
    const { user } = useAppState();
    const [q, setQ] = useState<QuestionDetail | undefined>();
    const [error, setError] = useState<string | undefined>();
    const [answer, setAnswer] = useState('');
    const [sendError, setSendError] = useState<string | undefined>();
    const [busy, setBusy] = useState(false);
    const [flagged, setFlagged] = useState<ReadonlySet<string>>(new Set());
    const [notice, setNotice] = useState<string | undefined>();

    const load = useCallback(async () =>
    {
        const r = await poomApi.community.get(id);
        setError(r.ok ? undefined : r.code);
        setQ(r.ok ? r.data : undefined);
    }, [id]);

    useEffect(() =>
    {
        void load();
    }, [load]);

    const send = async (e: FormEvent) =>
    {
        e.preventDefault();
        setBusy(true);
        const r = await poomApi.community.answer(id, answer);
        setBusy(false);
        setSendError(r.ok ? undefined : r.code);
        if (r.ok)
        {
            setAnswer('');
            await load();
        }
    };

    const flag = async (answerId?: string) =>
    {
        const r = await poomApi.community.flag(id, answerId);
        if (r.ok)
        {
            setFlagged(new Set([...flagged, answerId ?? id]));
            setNotice(r.data.hidden ? t('community.hiddenNow') : t('community.flagged'));
            if (r.data.hidden)
            {
                await load();
            }
        }
    };

    const solve = async (answerId: string) =>
    {
        const r = await poomApi.community.solve(id, answerId);
        if (r.ok)
        {
            await load();
        }
    };

    if (error)
    {
        return (
            <div className="page page--narrow">
                <ErrorBox code={error} />
                <Link className="btn btn--outline" to={path('/community')}>← {t('community.back')}</Link>
            </div>
        );
    }
    if (!q)
    {
        return <div className="page page--narrow"><Loading /></div>;
    }

    return (
        <div className="page page--narrow">
            <Link className="back-link" to={path('/community')}>← {t('community.back')}</Link>
            <article className="card qa-question" lang={q.lang}>
                <span className="qa-item__tags">
                    <span className="tag tag--muted">{t(('community.topic.' + q.topic) as TextKey)}</span>
                    {q.solvedAnswerId && <span className="tag tag--fit">✓ {t('community.solved')}</span>}
                    {q.example && <span className="tag tag--muted">{t('community.example')}</span>}
                    {q.mine && <span className="tag">{t('community.mine')}</span>}
                </span>
                <h1 className="qa-question__title">{q.title}</h1>
                <p className="qa-question__body">{q.body}</p>
                <p className="qa-item__meta muted"><AliasBadge alias={q.alias} /> · {shortDate(q.createdAt, lang)}</p>
                {user && !q.mine && !q.example && (
                    <button type="button" className="btn btn--ghost btn--small" disabled={flagged.has(q.id)} onClick={() => void flag()}>🚩 {t('community.flag')}</button>
                )}
            </article>

            {notice && <p className="notice" role="status">{notice}</p>}

            <h2>💬 {t('community.answers', { n: q.answers.length })}</h2>
            {q.answers.length === 0 && <p className="muted">{t('community.noAnswer')}</p>}
            <ul className="qa-answers">
                {q.answers.map((a) => (
                    <li key={a.id} className={'card qa-answer' + (a.official ? ' qa-answer--official' : '') + (q.solvedAnswerId === a.id ? ' qa-answer--solved' : '')}>
                        <p className="qa-item__meta">
                            <AliasBadge alias={a.alias} />
                            {q.solvedAnswerId === a.id && <span className="tag tag--fit">✓ {t('community.helped')}</span>}
                        </p>
                        <p className="qa-answer__body">{a.body}</p>
                        <div className="btn-row btn-row--start">
                            <span className="muted">{shortDate(a.createdAt, lang)}</span>
                            {q.mine && !q.solvedAnswerId && !a.mine && (
                                <button type="button" className="btn btn--outline btn--small" onClick={() => void solve(a.id)}>👍 {t('community.markSolved')}</button>
                            )}
                            {user && !a.mine && !a.official && !q.example && (
                                <button type="button" className="btn btn--ghost btn--small" disabled={flagged.has(a.id)} onClick={() => void flag(a.id)}>🚩 {t('community.flag')}</button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {user ? (
                <form className="form" onSubmit={(e) => void send(e)}>
                    <label className="field">
                        <span className="field__label">{t('community.answerLabel')}</span>
                        <textarea className="input" rows={4} maxLength={TEXT_MAX} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t('community.answerPlaceholder')} required minLength={2} />
                    </label>
                    <p className="muted">🔒 {t('community.privacy')}</p>
                    {sendError && <ErrorBox code={sendError} />}
                    <button type="submit" className="btn btn--primary btn--block" disabled={busy || answer.trim().length < 2}>{t('community.answerSend')}</button>
                </form>
            ) : <LoginToWrite next={'/community/' + id} />}
        </div>
    );
}

export function AskPage()
{
    const { t, lang, path } = useLang();
    const { user } = useAppState();
    const navigate = useNavigate();
    const [topic, setTopic] = useState<CommunityTopic>('movein');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) =>
    {
        e.preventDefault();
        setBusy(true);
        const r = await poomApi.community.ask({ topic, title, body, lang });
        setBusy(false);
        if (!r.ok)
        {
            setError(r.code);
            return;
        }
        navigate(path('/community/' + r.data.id), { replace: true });
    };

    return (
        <div className="page page--narrow">
            <Link className="back-link" to={path('/community')}>← {t('community.back')}</Link>
            <h1>✏️ {t('community.ask')}</h1>
            <p className="muted">{t('community.anonNote')}</p>
            {!user ? <LoginToWrite next="/community/ask" /> : (
                <form className="form" onSubmit={(e) => void submit(e)}>
                    <fieldset className="field">
                        <legend className="field__label">{t('community.formTopic')}</legend>
                        <div className="seg seg--wrap">
                            {TOPICS.map((k) => (
                                <button type="button" key={k} className={topic === k ? 'seg__on' : ''} aria-pressed={topic === k} onClick={() => setTopic(k)}>{t(('community.topic.' + k) as TextKey)}</button>
                            ))}
                        </div>
                    </fieldset>
                    <label className="field">
                        <span className="field__label">{t('community.formTitle')}</span>
                        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required minLength={5} />
                    </label>
                    <label className="field">
                        <span className="field__label">{t('community.formBody')}</span>
                        <textarea className="input" rows={7} value={body} onChange={(e) => setBody(e.target.value)} maxLength={TEXT_MAX} required minLength={5} />
                        <span className="muted field__count">{body.length} / {TEXT_MAX}</span>
                    </label>
                    <p className="notice">🔒 {t('community.privacy')}</p>
                    {error && <ErrorBox code={error} />}
                    <button type="submit" className="btn btn--primary btn--block" disabled={busy || title.trim().length < 5 || body.trim().length < 5}>{t('community.formSend')}</button>
                </form>
            )}
        </div>
    );
}
