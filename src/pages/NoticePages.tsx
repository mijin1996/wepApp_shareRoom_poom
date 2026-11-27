// 공지사항 (SCR_ANNOUNCE_01 · 02): 목록 · 공지 보기, 홈 화면 고정 공지 띠
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { poomApi } from '../api/poomApi';
import type { NoticeView } from '../api/types';
import { Empty, ErrorBox, Loading } from '../components/States';
import { useLang, type Lang, type TextKey } from '../i18n/i18n';
import { shortDate } from '../lib/format';

// 영어가 비어 있으면 한국어 그대로 보여 주고 "한국어 공지" 표시 (POL_NOTICE_03)
export function noticeText(n: NoticeView, lang: Lang): { title: string; body: string; koOnly: boolean }
{
    if (lang === 'en' && n.titleEn)
    {
        return { title: n.titleEn, body: n.bodyEn || n.bodyKo, koOnly: false };
    }
    return { title: n.titleKo, body: n.bodyKo, koOnly: lang === 'en' };
}

function NoticeTags({ notice }: { notice: NoticeView })
{
    const { t, lang } = useLang();
    return (
        <span className="qa-item__tags">
            {notice.pinned && <span className="tag">📌 {t('notice.pinned')}</span>}
            <span className="tag tag--muted">{t(('notice.cat.' + notice.category) as TextKey)}</span>
            {notice.example && <span className="tag tag--muted">{t('community.example')}</span>}
            {lang === 'en' && !notice.titleEn && <span className="tag tag--muted">한국어</span>}
        </span>
    );
}

export function NoticesPage()
{
    const { t, lang, path } = useLang();
    const [list, setList] = useState<NoticeView[] | undefined>();
    const [error, setError] = useState<string | undefined>();

    const load = () =>
    {
        setError(undefined);
        void poomApi.notices().then((r) =>
        {
            setError(r.ok ? undefined : r.code);
            setList(r.ok ? r.data : []);
        });
    };
    useEffect(load, []);

    return (
        <div className="page page--narrow">
            <h1>📢 {t('notice.title')}</h1>
            {error && <ErrorBox code={error} onRetry={load} />}
            {!list && !error && <Loading />}
            {list && list.length === 0 && !error && <Empty icon="📢" title={t('notice.empty')} />}
            <ul className="qa-list">
                {(list ?? []).map((n) => (
                    <li key={n.id}>
                        <Link className={'card qa-item' + (n.pinned ? ' notice-item--pinned' : '')} to={path('/notices/' + n.id)}>
                            <NoticeTags notice={n} />
                            <span className="qa-item__title">{noticeText(n, lang).title}</span>
                            <span className="qa-item__meta muted">{shortDate(n.createdAt, lang)}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function NoticePage()
{
    const { id = '' } = useParams();
    const { t, lang, path } = useLang();
    const [notice, setNotice] = useState<NoticeView | undefined>();
    const [error, setError] = useState<string | undefined>();

    useEffect(() =>
    {
        void poomApi.notice(id).then((r) =>
        {
            setError(r.ok ? undefined : r.code);
            setNotice(r.ok ? r.data : undefined);
        });
    }, [id]);

    const back = <Link className="back-link" to={path('/notices')}>← {t('notice.back')}</Link>;
    if (error)
    {
        return <div className="page page--narrow">{back}<ErrorBox code={error} /></div>;
    }
    if (!notice)
    {
        return <div className="page page--narrow"><Loading /></div>;
    }
    const text = noticeText(notice, lang);
    return (
        <div className="page page--narrow">
            {back}
            <article className="card qa-question" lang={text.koOnly ? 'ko' : lang}>
                <NoticeTags notice={notice} />
                <h1 className="qa-question__title">{text.title}</h1>
                <p className="qa-item__meta muted">{shortDate(notice.createdAt, lang)}{notice.updatedAt !== notice.createdAt ? ' · ' + t('notice.updated') : ''}</p>
                <p className="qa-question__body">{text.body}</p>
            </article>
        </div>
    );
}

// 홈 화면: 📌 고정 공지 띠 (고정이 없으면 숨김)
export function PinnedNoticeStrip()
{
    const { t, lang, path } = useLang();
    const [pinned, setPinned] = useState<NoticeView[]>([]);

    useEffect(() =>
    {
        void poomApi.notices().then((r) => setPinned(r.ok ? r.data.filter((n) => n.pinned) : []));
    }, []);

    if (pinned.length === 0)
    {
        return null;
    }
    return (
        <section className="notice-strip" aria-label={t('notice.title')}>
            {pinned.map((n) => (
                <Link key={n.id} className="notice-strip__item" to={path('/notices/' + n.id)}>
                    <span aria-hidden="true">📌</span>
                    <span className="notice-strip__title">{noticeText(n, lang).title}</span>
                </Link>
            ))}
            <Link className="notice-strip__all" to={path('/notices')}>{t('notice.all')} →</Link>
        </section>
    );
}
