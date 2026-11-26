// 긴급 도움 (SCR_HELP_01): 누르면 바로 전화. 영어 화면은 다국어 상담 번호를 위에
import { useLang } from '../i18n/i18n';
import { useMeta } from '../lib/useMeta';
import { Sheet } from './Sheet';

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void })
{
    const { t, lang } = useLang();
    const meta = useMeta();
    const contacts = [...(meta?.help ?? [])].sort((a, b) => Number(b.for.includes(lang)) - Number(a.for.includes(lang)));

    return (
        <Sheet open={open} title={t('help.title')} onClose={onClose}>
            <p className="muted">{t('help.sub')}</p>
            <ul className="help-list">
                {contacts.map((c) => (
                    <li key={c.number}>
                        <a className="help-item" href={'tel:' + c.number}>
                            <span className="help-item__num">{c.number.length === 8 ? c.number.replace(/(\d{4})(\d{4})/, '$1-$2') : c.number}</span>
                            <span className="help-item__name">{lang === 'en' ? c.name_en : c.name_ko}</span>
                            <span aria-hidden="true">📞</span>
                        </a>
                    </li>
                ))}
            </ul>
        </Sheet>
    );
}
