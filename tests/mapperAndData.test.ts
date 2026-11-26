// Mapper 방어 변환 · 데이터 파일 JSON Schema 검사
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import houses from '../data/houses.json';
import places from '../data/places.json';
import housesSchema from '../schema/houses.schema.json';
import placesSchema from '../schema/places.schema.json';
import { toHouseModel, toRoomModel } from '../server/mappers/seedMapper';

describe('Mapper', () =>
{
    it('빈 DTO 도 안전한 기본값으로 바뀐다', () =>
    {
        // Given
        const dto = {};

        // When
        const house = toHouseModel(dto);

        // Then
        expect(house.type).toBe('mom');
        expect(house.households).toBe(1);
        expect(house.pois).toEqual([]);
        expect(house.location).toEqual(house.dongCenter);
    });

    it('이상한 값(음수 · 모르는 상태 · 날짜 형식 틀림)은 걸러진다', () =>
    {
        const room = toRoomModel({ bedrooms: -3, deposit: -1, status: 'weird', available_from: '내일' }, 'h1');

        expect(room.bedrooms).toBe(1);
        expect(room.deposit).toBe(0);
        expect(room.status).toBe('occupied');       // 모르면 신청 못 하게
        expect(room.availableFrom).toBe('2099-12-31');
    });
});

describe('데이터 파일', () =>
{
    const ajv = new Ajv({ allErrors: true, strict: false });

    it('houses.json 이 스키마에 맞다', () =>
    {
        const valid = ajv.validate(housesSchema, houses);
        expect(ajv.errorsText()).toBe('No errors');
        expect(valid).toBe(true);
    });

    it('places.json 이 스키마에 맞다', () =>
    {
        expect(ajv.validate(placesSchema, places)).toBe(true);
    });
});
