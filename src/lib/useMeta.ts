// /api/meta (자주 묻는 질문 · 긴급 연락처 · 신고 종류)를 한 번만 받아 나눠 쓴다
import { useEffect, useState } from 'react';
import { poomApi } from '../api/poomApi';
import type { MetaView } from '../api/types';

let _cache: MetaView | undefined;
let _pending: Promise<MetaView | undefined> | undefined;

async function loadAsync(): Promise<MetaView | undefined>
{
    if (_cache)
    {
        return _cache;
    }
    _pending ??= poomApi.meta().then((r) =>
    {
        _cache = r.ok ? r.data : undefined;
        _pending = undefined;
        return _cache;
    });
    return _pending;
}

export function useMeta(): MetaView | undefined
{
    const [meta, setMeta] = useState<MetaView | undefined>(_cache);
    useEffect(() =>
    {
        let alive = true;
        void loadAsync().then((m) =>
        {
            if (alive)
            {
                setMeta(m);
            }
        });
        return () =>
        {
            alive = false;
        };
    }, []);
    return meta;
}
