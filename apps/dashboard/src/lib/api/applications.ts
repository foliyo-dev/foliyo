import { api } from './client';

export type ApplicationStatus =
	| 'application_received'
	| 'viewed'
	| 'shortlisted'
	| 'interview_scheduled'
	| 'offer_extended'
	| 'hired'
	| 'rejected'
	| 'withdrawn'
	| 'on_hold';

export const applicationStatuses: { value: ApplicationStatus; label: string }[] = [
	{ value: 'application_received', label: 'Applied' },
	{ value: 'viewed', label: 'Viewed by recruiter' },
	{ value: 'shortlisted', label: 'Shortlisted' },
	{ value: 'interview_scheduled', label: 'Interview scheduled' },
	{ value: 'offer_extended', label: 'Offer extended' },
	{ value: 'hired', label: 'Hired' },
	{ value: 'rejected', label: 'Rejected' },
	{ value: 'withdrawn', label: 'Withdrawn' },
	{ value: 'on_hold', label: 'On hold' }
];

export type Application = {
	id: string;
	user_id: string;
	resume_id: string | null;
	company: string;
	role: string;
	job_id: string | null;
	ats: string | null;
	status: ApplicationStatus;
	next_step: string | null;
	notes: string | null;
	source: string;
	applied_at: string;
	status_updated_at: string;
	resume_name?: string | null;
	resume_share_token?: string | null;
};

export const listApplications = () => api<Application[]>('/applications');
export const getApplication = (id: string) =>
	api<Application & { events: unknown[] }>(`/applications/${id}`);
export const createApplication = (data: Partial<Application>) =>
	api<Application[]>('/applications', { method: 'POST', body: JSON.stringify(data) });
export const updateApplication = (id: string, data: Partial<Application>) =>
	api<{ ok: boolean }>(`/applications/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteApplication = (id: string) =>
	api<void>(`/applications/${id}`, { method: 'DELETE' });

export function statusLabel(status: string): string {
	return applicationStatuses.find((s) => s.value === status)?.label ?? status;
}

/** Progress 1–6 for pipeline visualization. */
export function statusStep(status: ApplicationStatus): number {
	const order: ApplicationStatus[] = [
		'application_received',
		'viewed',
		'shortlisted',
		'interview_scheduled',
		'offer_extended',
		'hired'
	];
	if (status === 'rejected' || status === 'withdrawn') return 0;
	if (status === 'on_hold') return 2;
	const i = order.indexOf(status);
	return i < 0 ? 1 : i + 1;
}
