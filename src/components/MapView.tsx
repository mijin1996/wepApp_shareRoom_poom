// 지도로 찾기 (SCR_MAP_01): 동 단위 묶음만, 정확한 위치 핀 없음 (POL_SEARCH_01)
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapCluster } from '../api/types';
import { useLang } from '../i18n/i18n';
import { won } from '../lib/format';

const SEOUL: L.LatLngExpression = [37.5665, 126.978];
const DEFAULT_ZOOM = 11;

interface MapViewProps
{
    readonly clusters: readonly MapCluster[];
    readonly selectedDong: string | undefined;
    readonly onSelect: (dong: string | undefined) => void;
}

function escapeHtml(text: string): string
{
    return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export function MapView({ clusters, selectedDong, onSelect }: MapViewProps)
{
    const { lang, t } = useLang();
    const boxRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);

    useEffect(() =>
    {
        if (!boxRef.current || mapRef.current)
        {
            return;
        }
        const map = L.map(boxRef.current, { zoomControl: true, attributionControl: true }).setView(SEOUL, DEFAULT_ZOOM);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 16,
            attribution: '&copy; OpenStreetMap',
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        // 화면 크기가 바뀌면 지도도 다시 맞춘다 (회전 · 폴더블)
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(boxRef.current);
        return () =>
        {
            observer.disconnect();
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() =>
    {
        const map = mapRef.current;
        const layer = layerRef.current;
        if (!map || !layer)
        {
            return;
        }
        layer.clearLayers();
        for (const cluster of clusters)
        {
            const name = lang === 'en' ? cluster.dongEn : cluster.dongKo;
            const html = `<span class="map-pin__name">${escapeHtml(name)}</span><span class="map-pin__price">${escapeHtml(won(cluster.minMonthly, lang))}~ · ${cluster.vacantCount}</span>`;
            const icon = L.divIcon({ className: 'map-pin' + (selectedDong === cluster.dongKo ? ' map-pin--on' : ''), html, iconSize: undefined });
            L.marker([cluster.center[0], cluster.center[1]], { icon, keyboard: true, title: name })
                .on('click', () => onSelect(selectedDong === cluster.dongKo ? undefined : cluster.dongKo))
                .addTo(layer);
        }
        if (clusters.length > 0)
        {
            const bounds = L.latLngBounds(clusters.map((c) => [c.center[0], c.center[1]] as L.LatLngTuple));
            map.fitBounds(bounds.pad(0.4), { maxZoom: 14 });
        }
    }, [clusters, selectedDong, lang, onSelect]);

    return (
        <div className="map-wrap">
            <div ref={boxRef} className="map" role="application" aria-label={t('rooms.map')} />
            <p className="map-hint">🔒 {t('rooms.mapHint')}</p>
        </div>
    );
}
