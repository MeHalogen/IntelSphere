function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function textSignal(e) {
  const t = `${e.title} ${e.description ?? ''}`.toLowerCase();
  let s = 0;
  if (/evac|evacu/i.test(t)) s += 10;
  if (/tsunami/i.test(t)) s += 18;
  if (/ash|eruption|pyroclastic/i.test(t)) s += 14;
  if (/flash\s*flood|inundat/i.test(t)) s += 12;
  if (/state\s*of\s*emergency|disaster\s*declaration/i.test(t)) s += 16;
  return s;
}

export function scoreEvent(e) {
  const ageMs = Date.now() - Date.parse(e.time);
  const windowMs = 48 * 3600 * 1000;
  const recencyScore = clamp01(1 - ageMs / windowMs) * 20;

  const linkScore = (e.links?.news ? 10 : 0) + (e.links?.url ? 5 : 0);
  const textScore = textSignal(e);

  const popScore = 6;
  const infraScore = 6;

  let layerScore = 0;
  if (e.layer === 'earthquakes') {
    const mag = Number(e.metrics?.magnitude ?? 0);
    layerScore = clamp01((mag - 3.8) / 4.2) * 62;
    if (Boolean(e.metrics?.tsunami)) layerScore += 12;
  } else if (e.layer === 'wildfires') {
    layerScore = 35;
  } else if (e.layer === 'floods') {
    layerScore = 42;
  } else if (e.layer === 'storms') {
    layerScore = 40;
  } else if (e.layer === 'volcanoes') {
    layerScore = 46;
  } else if (e.layer === 'conflicts') {
    layerScore = 50;
  } else if (e.layer === 'airspace') {
    const count = Number(e.metrics?.aircraftCount ?? 0);
    const slowRatio = Number(e.metrics?.slowRatio ?? 0);
    layerScore = clamp(Math.log10(Math.max(1, count)) * 18 + slowRatio * 60, 0, 70);
  }

  const total = layerScore + recencyScore + linkScore + textScore + popScore + infraScore;
  return clamp(total, 0, 100);
}
