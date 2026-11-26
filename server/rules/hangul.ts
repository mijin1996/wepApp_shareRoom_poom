// 한글 초성 검색: "ㅁㅍ" → 마포 (REQ_030)
const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const SYLLABLES_PER_CHOSEONG = 588;

export function toChoseong(text: string): string
{
    let result = '';
    for (const ch of text)
    {
        const code = ch.charCodeAt(0);
        if (code >= HANGUL_START && code <= HANGUL_END)
        {
            result += CHOSEONG[Math.floor((code - HANGUL_START) / SYLLABLES_PER_CHOSEONG)];
        }
        else
        {
            result += ch;
        }
    }
    return result;
}

function isAllChoseong(text: string): boolean
{
    return [...text].every((ch) => CHOSEONG.includes(ch));
}

// 이름이 검색어로 시작하거나 포함하면 true (대소문자 · 공백 무시)
export function matchesQuery(name: string, query: string): boolean
{
    const q = query.replace(/\s+/g, '').toLowerCase();
    if (q.length === 0)
    {
        return false;
    }
    const target = name.replace(/\s+/g, '').toLowerCase();
    if (isAllChoseong(q))
    {
        return toChoseong(target).includes(q);
    }
    return target.includes(q);
}
