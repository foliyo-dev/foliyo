/**
 * Parse hosted `plan_expires` stamps from the API.
 * Accepts SQL `YYYY-MM-DD HH:MM:SS` (UTC, no zone) and ISO strings with `T` / `Z` / offsets.
 * Never returns an Invalid Date — null when unparseable.
 */
export function parsePlanExpires(stamp: string | null | undefined): Date | null {
	if (!stamp) return null;
	const s = String(stamp).trim();
	if (!s) return null;

	let candidate = s;
	if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(candidate)) {
		if (!candidate.includes('T')) candidate = candidate.replace(' ', 'T');
		// Drop fractional seconds if present without a zone, then treat as UTC.
		candidate = candidate.replace(/\.\d+$/, '');
		if (!/[zZ]$/.test(candidate)) candidate = `${candidate}Z`;
	}

	const d = new Date(candidate);
	return Number.isNaN(d.getTime()) ? null : d;
}

export function formatPlanExpiresLabel(stamp: string | null | undefined): string {
	const d = parsePlanExpires(stamp);
	if (!d) return '';
	return d.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}
