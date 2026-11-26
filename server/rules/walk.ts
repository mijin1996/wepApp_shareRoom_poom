// 걸어서 몇 분 — 위치를 거꾸로 알 수 없게 5분 단위로 올림 (POL_SEARCH_02)
import type { LatLng } from '../models/housing';

const EARTH_RADIUS_M = 6371000;
const WALK_METERS_PER_MINUTE = 67;      // 보통 걸음 약 4km/h
const ROUND_STEP_MINUTES = 5;
const ROAD_FACTOR = 1.3;                 // 직선거리보다 실제 길이 더 김

function toRadians(degree: number): number
{
    return (degree * Math.PI) / 180;
}

export function distanceMeters(a: LatLng, b: LatLng): number
{
    const dLat = toRadians(b[0] - a[0]);
    const dLng = toRadians(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a[0])) * Math.cos(toRadians(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function walkMinutesRounded(a: LatLng, b: LatLng): number
{
    const minutes = (distanceMeters(a, b) * ROAD_FACTOR) / WALK_METERS_PER_MINUTE;
    return Math.max(ROUND_STEP_MINUTES, Math.ceil(minutes / ROUND_STEP_MINUTES) * ROUND_STEP_MINUTES);
}
