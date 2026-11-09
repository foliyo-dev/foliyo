import { api, ApiError } from './client';
import { parseUpgradeError } from './plan';

export type AiUsage = {
	day: string;
	units: number;
	limit: number;
	remaining: number;
	costs: {
		import: number;
		rewrite: number;
		analyze?: number;
		summary?: number;
		theme?: number;
	};
	tokens_in: number;
	tokens_out: number;
	import_count: number;
	rewrite_count: number;
	openrouter: boolean;
	/** Self-host BYOK (no Foliyo unit pool). */
	byok?: boolean;
};

export type ThemeRecipe = 'classic' | 'photo-hero' | 'gallery-grid' | 'glassmorphic';

export type ThemeConfig = {
	version: 1;
	recipe: ThemeRecipe;
	skin?: Record<string, unknown>;
	content?: Record<string, unknown>;
	chrome?: Record<string, unknown>;
};

export type ThemeGenerateResult = {
	theme_config: ThemeConfig;
	meta: {
		model: string;
		tokens_in: number;
		tokens_out: number;
		units_spent: number;
		units_remaining: number | null;
	};
};

export type GapFinding = {
	id: string;
	severity: 'info' | 'warn' | 'ok';
	title: string;
	detail: string;
};

export type GapCheckResult = {
	matched_skills: Array<{ id: string; name: string }>;
	missing_skill_hints: string[];
	findings: GapFinding[];
	llm: false;
};

export type RewriteTone = 'stronger' | 'shorter' | 'metrics';

export type RewriteResult = {
	text: string;
	tone: RewriteTone;
	meta: {
		model: string;
		tokens_in: number;
		tokens_out: number;
		units_spent: number;
		units_remaining: number | null;
	};
};

export type SummaryResult = {
	headline: string;
	bio: string;
	meta: {
		model: string;
		tokens_in: number;
		tokens_out: number;
		units_spent: number;
		units_remaining: number | null;
	};
};

export const getAiUsage = () => api<AiUsage>('/ai/usage');

export const gapCheck = (jd_text: string) =>
	api<GapCheckResult>('/ai/gap-check', {
		method: 'POST',
		body: JSON.stringify({ jd_text })
	});

export async function rewriteBullet(input: {
	text: string;
	tone?: RewriteTone;
	jd_text?: string;
}): Promise<RewriteResult> {
	try {
		return await api<RewriteResult>('/ai/rewrite', {
			method: 'POST',
			body: JSON.stringify(input)
		});
	} catch (err) {
		if (err instanceof ApiError) {
			const upgrade = parseUpgradeError(err);
			if (upgrade) throw Object.assign(err, { upgrade });
		}
		throw err;
	}
}

export async function generateResumeSummary(input: {
	jd_text: string;
	skill_names?: string[];
}): Promise<SummaryResult> {
	try {
		return await api<SummaryResult>('/ai/summary', {
			method: 'POST',
			body: JSON.stringify(input)
		});
	} catch (err) {
		if (err instanceof ApiError) {
			const upgrade = parseUpgradeError(err);
			if (upgrade) throw Object.assign(err, { upgrade });
		}
		throw err;
	}
}

export async function generateThemeConfig(input: {
	prompt: string;
	portfolio_id?: string;
	preferred_recipe?: ThemeRecipe;
}): Promise<ThemeGenerateResult> {
	try {
		return await api<ThemeGenerateResult>('/ai/theme', {
			method: 'POST',
			body: JSON.stringify(input)
		});
	} catch (err) {
		if (err instanceof ApiError) {
			const upgrade = parseUpgradeError(err);
			if (upgrade) throw Object.assign(err, { upgrade });
		}
		throw err;
	}
}
