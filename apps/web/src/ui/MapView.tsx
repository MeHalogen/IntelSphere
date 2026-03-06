import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Deck } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import type { CrisisEvent } from '../core/types';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

function severityColor(score: number): [number, number, number, number] {
  if (score >= 80) return [255, 77, 106, 200];  // critical — red
  if (score >= 60) return [255, 160, 80, 190];   // high — orange
  if (score >= 35) return [255, 200, 60, 180];   // medium — yellow
  return [80, 200, 160, 170];                     // low — teal
}

function radiusMeters(e: CrisisEvent) {
  const base = Math.max(8, Math.min(30, (e.severityScore / 100) * 26 + 8));
  return base * 1000;
}

export function MapView(props: {
  events: CrisisEvent[];
  selectedEvent: CrisisEvent | null;
  onPick: (id: string) => void;
  onCloseCard: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const deckCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const deckRef = useRef<Deck | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [10, 20],
      zoom: 1.6,
      pitch: 0,
      bearing: 0,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    const canvas = deckCanvasRef.current!;
    const deck = new Deck({
      canvas,
      initialViewState: {
        longitude: 10,
        latitude: 20,
        zoom: 1.6,
        pitch: 0,
        bearing: 0
      },
      controller: true,
      onViewStateChange: ({ viewState }: { viewState: any }) => {
        map.jumpTo({
          center: [viewState.longitude, viewState.latitude],
          zoom: viewState.zoom,
          bearing: viewState.bearing,
          pitch: viewState.pitch
        });
      }
    });

    deckRef.current = deck;

    const sync = () => {
      const c = map.getCenter();
      deck.setProps({
        viewState: {
          longitude: c.lng,
          latitude: c.lat,
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch()
        }
      });
    };
    map.on('move', sync);

    return () => {
      map.off('move', sync);
      deck.finalize();
      map.remove();
      deckRef.current = null;
      mapRef.current = null;
    };
  }, []);

  const layers = useMemo(() => {
    return [
      new ScatterplotLayer<CrisisEvent>({
        id: 'events',
        data: props.events,
        pickable: true,
        stroked: true,
        filled: true,
        radiusUnits: 'meters',
        getPosition: (d: CrisisEvent) => [d.lon, d.lat],
        getFillColor: (d: CrisisEvent) => severityColor(d.severityScore),
        getLineColor: (_d: CrisisEvent) => [10, 14, 28, 180],
        lineWidthUnits: 'pixels',
        getLineWidth: (d: CrisisEvent) => (d.id === props.selectedEvent?.id ? 3 : 1),
        getRadius: (d: CrisisEvent) => (d.id === props.selectedEvent?.id ? radiusMeters(d) * 1.4 : radiusMeters(d)),
        radiusMinPixels: 3,
        radiusMaxPixels: 28,
        updateTriggers: {
          getLineWidth: [props.selectedEvent?.id],
          getRadius: [props.selectedEvent?.id]
        },
        onClick: (info: any) => {
          const obj = info.object as CrisisEvent | undefined;
          if (obj?.id) props.onPick(obj.id);
        }
      })
    ];
  }, [props.events, props.onPick, props.selectedEvent?.id]);

  useEffect(() => {
    deckRef.current?.setProps({ layers });
  }, [layers]);

  // Fly to selected event
  useEffect(() => {
    if (props.selectedEvent && mapRef.current) {
      mapRef.current.flyTo({
        center: [props.selectedEvent.lon, props.selectedEvent.lat],
        zoom: Math.max(mapRef.current.getZoom(), 4),
        duration: 800,
      });
    }
  }, [props.selectedEvent?.id]);

  return (
    <div className="cm-map">
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <canvas
        ref={deckCanvasRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
      />
    </div>
  );
}
