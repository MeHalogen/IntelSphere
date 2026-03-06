import type { CrisisLayer } from '../core/types';
import { useUiStore } from './store';

const LAYERS: Array<{ id: CrisisLayer; label: string }> = [
  { id: 'earthquakes', label: 'Earthquakes' },
  { id: 'wildfires', label: 'Wildfires' },
  { id: 'floods', label: 'Floods' },
  { id: 'storms', label: 'Storms' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'airspace', label: 'Airspace' },
  { id: 'volcanoes', label: 'Volcanoes' },
];

export function LayersPanel() {
  const { activeLayers, toggleLayer } = useUiStore();

  return (
    <div className="cm-layer-grid">
      {LAYERS.map((l) => {
        const on = activeLayers.includes(l.id);
        return (
          <button
            key={l.id}
            className={`cm-layer-btn${on ? ' active' : ''}`}
            onClick={() => toggleLayer(l.id)}
          >
            <span className="cm-layer-dot" />
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
