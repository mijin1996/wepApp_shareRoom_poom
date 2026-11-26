// 시트: 휴대폰은 아래에서 올라오고, 넓은 화면은 가운데 창. 내용만 스크롤되고 버튼 줄은 항상 보인다
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../i18n/i18n';

interface SheetProps
{
    readonly open: boolean;
    readonly title: string;
    readonly onClose: () => void;
    readonly children: ReactNode;
    readonly footer?: ReactNode;
    readonly wide?: boolean;
}

export function Sheet({ open, title, onClose, children, footer, wide }: SheetProps)
{
    const { t } = useLang();
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() =>
    {
        if (!open)
        {
            return;
        }
        const previous = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        document.body.classList.add('no-scroll');
        const onKey = (e: KeyboardEvent) =>
        {
            if (e.key === 'Escape')
            {
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () =>
        {
            window.removeEventListener('keydown', onKey);
            document.body.classList.remove('no-scroll');
            previous?.focus();
        };
    }, [open, onClose]);

    if (!open)
    {
        return null;
    }
    return createPortal(
        <div className="sheet-backdrop" onMouseDown={(e) =>
        {
            if (e.target === e.currentTarget)
            {
                onClose();
            }
        }}>
            <div className={'sheet' + (wide ? ' sheet--wide' : '')} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panelRef}>
                <div className="sheet__head">
                    <h2 className="sheet__title">{title}</h2>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>✕</button>
                </div>
                <div className="sheet__body">{children}</div>
                {footer && <div className="sheet__foot">{footer}</div>}
            </div>
        </div>,
        document.body,
    );
}
