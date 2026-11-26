// 방 찾기 · 검색 · 지역 수요 (REQ_001 · 024 · 030 · 032 · 036, POL_SEARCH) — TC_001 · 033 · 035
import { describe, expect, it } from 'vitest';
import { makeContainer, unwrap } from './helpers';

describe('방 찾기', () =>
{
    it('화면에 보내는 방 정보에는 정확한 위치 · 주소 · 출입 정보가 없다 (POL_SEARCH_01)', async () =>
    {
        // Given
        const { c } = makeContainer();

        // When
        const rooms = unwrap(await c.rooms.searchAsync({ children: [] }));

        // Then
        const json = JSON.stringify(rooms);
        expect(rooms.length).toBeGreaterThan(0);
        expect(json).not.toContain('Mock 주소');
        expect(json).not.toContain('비밀번호');
        expect(json).not.toContain('"location"');
    });

    it('[바로 입주]는 7일 안에 들어갈 수 있는 방만', async () =>
    {
        const { c } = makeContainer();

        const soon = unwrap(await c.rooms.searchAsync({ children: [], soon: true }));

        expect(soon.every((r) => r.availableSoon)).toBe(true);
        expect(soon.some((r) => r.roomId === 'r-mw-3')).toBe(false);   // 12-20 입주
    });

    it('엄마 + 9살 아들 + 11살 딸이면 침실 3 이상만 보인다', async () =>
    {
        const { c } = makeContainer();

        const rooms = unwrap(await c.rooms.searchAsync({ children: [{ ageBand: '8-12', gender: 'm' }, { ageBand: '8-12', gender: 'f' }] }));

        expect(rooms.length).toBeGreaterThan(0);
        expect(rooms.every((r) => r.bedrooms >= 3 && r.fit === 'fits')).toBe(true);
    });

    it('마포구로 찾으면 망원 하우스 방만, 입주 중인 방은 빠진다', async () =>
    {
        const { c } = makeContainer();

        const rooms = unwrap(await c.rooms.searchAsync({ children: [], placeId: 'gu-mapo' }));

        expect(rooms.every((r) => r.houseId === 'h-mangwon')).toBe(true);
        expect(rooms.some((r) => r.roomId === 'r-mw-4')).toBe(false);
    });

    it('지도는 동 단위 묶음만 준다', async () =>
    {
        const { c } = makeContainer();

        const clusters = unwrap(await c.rooms.clustersAsync({ children: [] }));

        expect(clusters.map((x) => x.dongKo).sort()).toEqual(['망원동', '불광동', '신림동']);
    });
});

describe('검색 추천', () =>
{
    it('"ㅁㅇ" 로 망원동 · 망원역 · 망원초등학교가 추천된다', async () =>
    {
        const { c } = makeContainer();

        const list = unwrap(await c.search.suggestAsync('ㅁㅇ'));

        const names = list.map((s) => s.nameKo);
        expect(names).toContain('망원동');
        expect(names).toContain('망원역');
    });

    it('"Mapo" 영문으로도 찾는다', async () =>
    {
        const { c } = makeContainer();

        const list = unwrap(await c.search.suggestAsync('Mapo'));

        expect(list.some((s) => s.id === 'gu-mapo')).toBe(true);
    });
});

describe('지역 수요', () =>
{
    it('같은 조건은 숫자만 늘고 개인 정보는 없다', async () =>
    {
        // Given
        const { c } = makeContainer();

        // When
        await c.search.recordDemandAsync({ gu: '노원구', householdSize: 3, monthly: 280000 });
        await c.search.recordDemandAsync({ gu: '노원구', householdSize: 3, monthly: 250000 });

        // Then
        const stats = unwrap(await c.search.demandStatsAsync());
        expect(stats[0]).toEqual({ id: '노원구|3|~30', gu: '노원구', householdSize: 3, priceBand: '~30', count: 2 });
    });
});
