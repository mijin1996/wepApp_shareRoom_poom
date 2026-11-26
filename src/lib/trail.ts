// 최근 3분 기록 (POL_REPORT_05): 메모리에만 들고 있다가 신고할 때만 보낸다
// 입력값 · 이름 · 전화번호는 기록하지 않는다 (POL_REPORT_04)
import type { TrailEntry } from '../api/types';

const KEEP_MS = 3 * 60 * 1000;
const MAX_TEXT = 60;

interface IMutableEntry
{
    at: number;
    kind: string;
    text: string;
    count: number;
}

const _log: IMutableEntry[] = [];
let _lastError = 0;

function trim(now: number): void
{
    while (_log.length > 0 && _log[0].at < now - KEEP_MS)
    {
        _log.shift();
    }
}

export function note(kind: 'screen' | 'click' | 'error', text: string): void
{
    const now = Date.now();
    trim(now);
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    const last = _log[_log.length - 1];
    if (last && last.kind === kind && last.text === clean)
    {
        last.count += 1;           // 같은 것이 이어지면 ×n
        last.at = now;
    }
    else
    {
        _log.push({ at: now, kind, text: clean, count: 1 });
    }
    if (kind === 'error')
    {
        _lastError = now;
    }
}

export function snapshot(): TrailEntry[]
{
    trim(Date.now());
    return _log.map((e) => ({ ...e }));
}

export function hadRecentError(): boolean
{
    return Date.now() - _lastError < KEEP_MS;
}

// "12초 전 [누름] 다음" 형식
export function describe(entry: TrailEntry, now: number): string
{
    const seconds = Math.max(0, Math.round((now - entry.at) / 1000));
    return `${seconds}s [${entry.kind}] ${entry.text}${entry.count > 1 ? ' ×' + entry.count : ''}`;
}

let _installed = false;

export function installTrail(): void
{
    if (_installed)
    {
        return;
    }
    _installed = true;
    window.addEventListener('error', (e) => note('error', e.message));
    window.addEventListener('unhandledrejection', (e) => note('error', String(e.reason)));
    const originalError = console.error.bind(console);
    console.error = (...args: unknown[]) =>
    {
        note('error', args.map(String).join(' '));
        originalError(...args);
    };
    // 버튼 · 링크를 누르면 그 글자만 남긴다 (입력칸 값은 남기지 않음)
    document.addEventListener('click', (e) =>
    {
        const target = (e.target as HTMLElement | null)?.closest('button, a, [role="button"]');
        if (target)
        {
            note('click', target.getAttribute('aria-label') ?? target.textContent ?? '');
        }
    }, true);
}
