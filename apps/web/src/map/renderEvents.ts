import type { Map as MlMap, GeoJSONSource, LngLatLike, Popup } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import type { CrisisEvent } from '../core/types';

// MapLibre style/source/layer IDs (stable for efficient updates)
const SOURCE_ID = 'cm-events';
const CLUSTER_LAYER_ID = 'cm-events-clusters';
const CLUSTER_COUNT_LAYER_ID = 'cm-events-cluster-count';
const UNCLUSTERED_LAYER_ID = 'cm-events-unclustered';

type FeatureProps = {
  id: string;
  title: string;
  description?: string;
  time: string;
  severityScore: number;
  severityLabel: CrisisEvent['severityLabel'];
  layer: CrisisEvent['layer'];
};

type Renderer = {
  renderEvents: (events: CrisisEvent[]) => void;
  updateEvents: (events: CrisisEvent[]) => void;
  clearEvents: () => void;
};

function toFeature(e: CrisisEvent): GeoJSON.Feature<GeoJSON.Point, FeatureProps> | null {
  const lon = Number(e.lon);
  const lat = Number(e.lat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      id: e.id,
      title: e.title,
      description: e.description,
      time: e.time,
      severityScore: e.severityScore,
      severityLabel: e.severityLabel,
      layer: e.layer
    }
  };
}

function toGeoJson(events: CrisisEvent[]): GeoJSON.FeatureCollection<GeoJSON.Point, FeatureProps> {
  const features: Array<GeoJSON.Feature<GeoJSON.Point, FeatureProps>> = [];
  for (const e of events) {
    const f = toFeature(e);
    if (f) features.push(f);
  }
  return { type: 'FeatureCollection', features };
}

function ensureOnLoad(map: MlMap, fn: () => void) {
  if ((map as any).loaded?.() ?? map.isStyleLoaded()) fn();
  else map.once('load', fn);
}

function stopPropagation(e: any) {
  try {
    e?.originalEvent?.stopPropagation?.();
  } catch {
    // ignore
  }
}

function popupHtml(p: FeatureProps) {
  const title = escapeHtml(p.title ?? '');
  const desc = escapeHtml(p.description ?? '');
  const time = new Date(p.time).toLocaleString();
  const score = Number.isFinite(p.severityScore) ? Math.round(p.severityScore) : 0;

  return `
<div style="min-width:240px; max-width:320px; font-family: ui-sans-serif, system-ui;">
  <div style="font-weight:700; margin-bottom:6px;">${title}</div>
  ${desc ? `<div style="font-size:12px; line-height:1.45; opacity:0.9; margin-bottom:8px;">${desc}</div>` : ''}
  <div style="font-size:12px; opacity:0.85;">${escapeHtml(time)}</div>
  <div style="margin-top:8px; display:flex; gap:8px; align-items:center;">
    <span style="font-size:12px; padding:2px 6px; border-radius:999px; background:rgba(255,255,255,0.12);">${escapeHtml(
      p.severityLabel
    )}</span>
    <span style="font-size:12px; opacity:0.9;">Score: <b>${score}</b></span>
  </div>
</div>`;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function addLayersAndSource(map: MlMap) {
  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterRadius: 45,
    clusterMaxZoom: 6,
    // Promote a stable id so feature-state can be used later if needed.
    promoteId: 'id'
  });

  // Cluster circles
  map.addLayer({
    id: CLUSTER_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#3b82f6', // blue
        25,
        '#f59e0b', // orange
        100,
        '#ef4444' // red
      ],
      'circle-radius': ['step', ['get', 'point_count'], 16, 25, 22, 100, 28],
      'circle-stroke-width': 1,
      'circle-stroke-color': 'rgba(0,0,0,0.35)'
    }
  });

  // Cluster count labels
  map.addLayer({
    id: CLUSTER_COUNT_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Open Sans Regular'],
      'text-size': 12
    },
    paint: {
      'text-color': 'rgba(255,255,255,0.92)'
    }
  });

  // Unclustered points
  map.addLayer({
    id: UNCLUSTERED_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    paint: {
      // critical=red, high=orange, medium=yellow, low=blue
      'circle-color': [
        'match',
        ['get', 'severityLabel'],
        'critical',
        '#ef4444',
        'high',
        '#f97316',
        'medium',
        '#facc15',
        /* low */ '#3b82f6'
      ],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0,
        3,
        4,
        5,
        7,
        7,
        10,
        10
      ],
      'circle-stroke-width': 1,
      'circle-stroke-color': 'rgba(0,0,0,0.45)',
      'circle-opacity': 0.92
    }
  });
}

function removeLayersAndSource(map: MlMap) {
  for (const id of [CLUSTER_COUNT_LAYER_ID, CLUSTER_LAYER_ID, UNCLUSTERED_LAYER_ID]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

function getSource(map: MlMap): GeoJSONSource | null {
  const src = map.getSource(SOURCE_ID);
  return (src as GeoJSONSource) ?? null;
}

export function createEventRenderer(map: MlMap): Renderer {
  let popup: Popup | null = null;
  let lastHash = '';

  function setData(events: CrisisEvent[]) {
    const geojson = toGeoJson(events);

    // Efficient re-rendering: avoid forcing setData if nothing changed.
    // This is a best-effort hash based on ids+scores+labels (good enough for polling dashboards).
    const h = fastHash(events);
    if (h === lastHash) return;
    lastHash = h;

    const src = getSource(map);
    if (!src) return;
    src.setData(geojson as any);
  }

  function wireInteractions() {
    // Zoom into clusters
    map.on('click', CLUSTER_LAYER_ID, (e: any) => {
      stopPropagation(e);
      const feat = e?.features?.[0];
      const clusterId = feat?.properties?.cluster_id;
      const coords = feat?.geometry?.coordinates as [number, number] | undefined;
      if (!coords || clusterId == null) return;

      const src: any = getSource(map);
      src?.getClusterExpansionZoom?.(clusterId, (err: any, zoom: number) => {
        if (err) return;
        map.easeTo({ center: coords as LngLatLike, zoom });
      });
    });

    // Popup for unclustered points
    map.on('click', UNCLUSTERED_LAYER_ID, (e: any) => {
      stopPropagation(e);
      const feat = e?.features?.[0];
      const props = feat?.properties as FeatureProps | undefined;
      const coords = feat?.geometry?.coordinates as [number, number] | undefined;
      if (!props || !coords) return;

      if (popup) popup.remove();
      popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '360px' })
        .setLngLat(coords as LngLatLike)
        .setHTML(popupHtml(props))
        .addTo(map);
    });

    // Cursor affordance
    for (const layerId of [CLUSTER_LAYER_ID, UNCLUSTERED_LAYER_ID]) {
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    }
  }

  ensureOnLoad(map, () => {
    addLayersAndSource(map);
    wireInteractions();
  });

  return {
    renderEvents(events: CrisisEvent[]) {
      ensureOnLoad(map, () => {
        addLayersAndSource(map);
        setData(events);
      });
    },

    updateEvents(events: CrisisEvent[]) {
      // Same as renderEvents but kept for API clarity.
      ensureOnLoad(map, () => setData(events));
    },

    clearEvents() {
      ensureOnLoad(map, () => {
        lastHash = '';
        if (popup) {
          popup.remove();
          popup = null;
        }
        const src = getSource(map);
        src?.setData({ type: 'FeatureCollection', features: [] } as any);
      });
    }
  };
}

function fastHash(events: CrisisEvent[]) {
  // FNV-1a like hash over a small stable signature.
  let h = 2166136261;
  const len = events.length;
  // Cap hashing work for giant lists; collisions are OK (we just sometimes re-render).
  const step = len > 2000 ? Math.ceil(len / 2000) : 1;

  for (let i = 0; i < len; i += step) {
    const e = events[i]!;
    const s = `${e.id}|${e.severityScore}|${e.severityLabel}|${e.time}`;
    for (let j = 0; j < s.length; j++) {
      h ^= s.charCodeAt(j);
      h = Math.imul(h, 16777619);
    }
  }

  h ^= len;
  return (h >>> 0).toString(16);
}
