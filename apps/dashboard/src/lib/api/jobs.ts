import { api } from './client';
import type { JobAnalysis, JobAnalysisSummary, SavedJobAnalysis } from '@foliyo/jobs-client';

export type * from '@foliyo/jobs-client';
export {
	approvedFromAnalysis,
	defaultAcceptedIds,
	hashJdText,
	normalizeJdText,
	popupBands,
	suggestedTailoredResumeName
} from '@foliyo/jobs-client';

export function analyzeJob(data: {
	jd_text: string;
	resume_id?: string;
	portfolio_id?: string;
	enhance?: boolean;
}) {
	return api<JobAnalysis>('/jobs/analyze', {
		method: 'POST',
		body: JSON.stringify(data)
	});
}

export function listJobAnalyses() {
	return api<{ items: JobAnalysisSummary[] }>('/jobs/analyses');
}

export function getSavedJobAnalysis(id: string) {
	return api<SavedJobAnalysis>(`/jobs/analyses/${id}`);
}

export function patchJobAnalysisAccepted(id: string, accepted: string[]) {
	return api<SavedJobAnalysis>(`/jobs/analyses/${id}`, {
		method: 'PUT',
		body: JSON.stringify({ accepted })
	});
}
