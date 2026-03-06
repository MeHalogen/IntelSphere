export const config = { runtime: 'edge' };

function fallbackBrief(eventId) {
	const now = new Date().toISOString();
	return {
		shortBrief: `Event ${eventId}: early signals detected. Monitor official updates and trusted news sources for confirmation and impact assessment.`,
		keyRisks: ['Information uncertainty / rumors', 'Escalation risk depending on secondary hazards', 'Infrastructure disruption'],
		expectedImpact: ['Localized service interruptions possible', 'Potential travel and logistics delays'],
		recommendedMonitoringActions: [
			'Track official agencies and verified field reports',
			'Watch for aftershocks / secondary hazards',
			'Monitor transport disruptions and advisories'
		],
		model: 'fallback',
		generatedAt: now
	};
}

export default async function handler(req, res) {
	const eventId = String(req.query?.eventId ?? '').trim();
	if (!eventId) {
		res.status(400).json({ error: 'Missing eventId' });
		return;
	}

	// Local dev: keep deterministic fallback (avoids secrets). Production edge func still exists in TS.
	const brief = fallbackBrief(eventId);

	res.setHeader('content-type', 'application/json; charset=utf-8');
	res.setHeader('cache-control', 'no-cache');
	res.status(200).send(JSON.stringify(brief));
}
