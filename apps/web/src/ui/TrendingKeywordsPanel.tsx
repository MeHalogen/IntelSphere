import type { FeedResponse } from '../core/types';

export function TrendingKeywordsPanel(props: { aggregates: FeedResponse['aggregates'] | undefined }) {
  const rows = props.aggregates?.trendingKeywords ?? [];
  if (rows.length === 0) return <div className="cm-empty">No keyword data.</div>;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {rows.map((k) => (
        <span key={k.keyword} className="cm-keyword-chip" title={`weight ${k.weight}`}>
          {k.keyword}
        </span>
      ))}
    </div>
  );
}
