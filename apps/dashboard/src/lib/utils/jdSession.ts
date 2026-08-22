export type JdSession = {
	v: 1;
	targetMode: 'jd';
	jdText: string;
	analysisId: string | null;
	accepted: string[];
	enhanceParse: boolean;
	/** '' = full library baseline; otherwise folio id for diff scope */
	scopeId: string;
};

const KEY = 'foliyo.jd-session';

export function loadJdSession(): JdSession | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<JdSession>;
		if (parsed.v !== 1 || parsed.targetMode !== 'jd') return null;
		return {
			v: 1,
			targetMode: 'jd',
			jdText: typeof parsed.jdText === 'string' ? parsed.jdText : '',
			analysisId: typeof parsed.analysisId === 'string' ? parsed.analysisId : null,
			accepted: Array.isArray(parsed.accepted) ? parsed.accepted.map(String) : [],
			enhanceParse: Boolean(parsed.enhanceParse),
			scopeId:
				typeof parsed.scopeId === 'string'
					? parsed.scopeId
					: typeof parsed.portfolioId === 'string'
						? parsed.portfolioId
						: ''
		};
	} catch {
		return null;
	}
}

export function saveJdSession(session: Omit<JdSession, 'v' | 'targetMode'>): void {
	if (typeof localStorage === 'undefined') return;
	if (!session.jdText.trim() && !session.analysisId) {
		clearJdSession();
		return;
	}
	const payload: JdSession = { v: 1, targetMode: 'jd', ...session };
	localStorage.setItem(KEY, JSON.stringify(payload));
}

export function clearJdSession(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(KEY);
}
