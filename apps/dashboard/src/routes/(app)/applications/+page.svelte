<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		listApplications,
		createApplication,
		updateApplication,
		deleteApplication,
		applicationStatuses,
		statusLabel,
		statusStep,
		type Application,
		type ApplicationStatus
	} from '$lib/api/applications';
	import { listResumes, type Resume } from '$lib/api/resumes';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';

	let items: Application[] = [];
	let resumes: Resume[] = [];
	let loading = true;
	let saving = false;
	let editingId: string | null = null;
	let showMore = false;

	let company = '';
	let role = '';
	let resumeId = '';
	let status: ApplicationStatus = 'application_received';
	let nextStep = '';
	let notes = '';
	let jobId = '';

	onMount(load);

	async function load() {
		loading = true;
		try {
			[items, resumes] = await Promise.all([listApplications(), listResumes()]);
		} catch {
			items = [];
			resumes = [];
			showToast('Failed to load applications', 'error');
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		company = '';
		role = '';
		resumeId = '';
		status = 'application_received';
		nextStep = '';
		notes = '';
		jobId = '';
		editingId = null;
		showMore = false;
	}

	function payload() {
		return {
			company: company.trim(),
			role: role.trim(),
			resume_id: resumeId || null,
			status,
			next_step: nextStep.trim() || null,
			notes: notes.trim() || null,
			job_id: jobId.trim() || null
		};
	}

	async function add() {
		if (!company.trim()) {
			showToast('Company is required', 'error');
			return;
		}
		saving = true;
		try {
			items = await createApplication(payload());
			showToast('Application logged', 'success');
			resetForm();
		} catch {
			showToast('Failed to add application', 'error');
		} finally {
			saving = false;
		}
	}

	function startEdit(a: Application) {
		editingId = a.id;
		company = a.company;
		role = a.role;
		resumeId = a.resume_id ?? '';
		status = a.status;
		nextStep = a.next_step ?? '';
		notes = a.notes ?? '';
		jobId = a.job_id ?? '';
		showMore = Boolean(a.next_step || a.job_id);
	}

	async function saveEdit() {
		if (!editingId) return;
		saving = true;
		try {
			await updateApplication(editingId, payload());
			await load();
			showToast('Application updated', 'success');
			resetForm();
		} catch {
			showToast('Failed to update application', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		const item = items.find((a) => a.id === id);
		if (!(await confirmDelete(item?.company?.trim() || 'this application'))) return;
		try {
			await deleteApplication(id);
			items = items.filter((a) => a.id !== id);
			if (editingId === id) resetForm();
			showToast('Application deleted', 'success');
		} catch {
			showToast('Failed to delete', 'error');
		}
	}

	function formatDate(iso: string | null | undefined) {
		if (!iso) return '';
		const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function pipelineDots(status: ApplicationStatus) {
		const step = statusStep(status);
		const terminal = status === 'rejected' || status === 'withdrawn';
		return Array.from({ length: 6 }, (_, i) => {
			if (terminal) return i === 0 ? 'term' : 'empty';
			return i < step ? 'on' : 'empty';
		});
	}
</script>

<PageHeader
	title={editingId ? 'Edit application' : 'Job applications'}
	description="Track where you applied and which resume you sent. This is not another portfolio — it’s a simple log of opportunities."
/>

<Card>
	<h2 class="section-title">{editingId ? 'Edit application' : 'Log an application'}</h2>
	<p class="form-hint">
		After you apply somewhere, note the company and the resume you used so you can follow up later.
	</p>
	<div class="fields">
		<Input label="Company" bind:value={company} placeholder="Acme Corp" />
		<Input label="Role" bind:value={role} placeholder="Senior Node.js Engineer" />
		<label class="field">
			<span class="label">Resume you sent</span>
			<select bind:value={resumeId}>
				<option value="">None yet</option>
				{#each resumes as r}
					<option value={r.id}>{r.name}</option>
				{/each}
			</select>
			{#if resumes.length === 0}
				<span class="field-hint">No resumes yet — <a href="/resume">create one from your library</a> first.</span>
			{/if}
		</label>
		<label class="field">
			<span class="label">Status</span>
			<select bind:value={status}>
				{#each applicationStatuses as s}
					<option value={s.value}>{s.label}</option>
				{/each}
			</select>
		</label>
		<Textarea label="Notes (optional)" bind:value={notes} rows={3} placeholder="Recruiter name, interview date, link to the posting…" />
		<details class="more" bind:open={showMore}>
			<summary>More details (optional)</summary>
			<div class="fields more-fields">
				<Input label="Next step" bind:value={nextStep} placeholder="e.g. Phone screen on Friday" />
				<Input label="Job / posting ID" bind:value={jobId} placeholder="Only if you have one from the employer" />
			</div>
		</details>
	</div>
	<div class="form-actions">
		{#if editingId}
			<Button disabled={saving} on:click={saveEdit}>{saving ? 'Saving…' : 'Save changes'}</Button>
			<Button variant="ghost" on:click={resetForm}>Cancel</Button>
		{:else}
			<Button disabled={saving} on:click={add}>{saving ? 'Saving…' : 'Log application'}</Button>
		{/if}
	</div>
</Card>

{#if loading}
	<p class="muted">Loading…</p>
{:else if items.length === 0}
	<p class="muted empty">
		No applications logged yet. When you apply for a role, add it here so you remember which resume you
		sent.
	</p>
{:else}
	<ul class="list">
		{#each items as a (a.id)}
			<li>
				<Card>
					<div class="row">
						<div class="main">
							<h2>{a.company}{#if a.role} · {a.role}{/if}</h2>
							<p class="meta">
								{#if a.resume_name}Resume sent: “{a.resume_name}” · {/if}
								Logged {formatDate(a.applied_at)}
								{#if a.source === 'ats'} · updated via ATS{/if}
								{#if a.ats} ({a.ats}){/if}
							</p>
							<div class="pipeline" aria-hidden="true">
								{#each pipelineDots(a.status) as d}
									<span class="dot {d}"></span>
								{/each}
								<span class="status-text">{statusLabel(a.status)}{#if a.next_step} → {a.next_step}{/if}</span>
							</div>
							{#if a.notes}
								<p class="notes">{a.notes}</p>
							{/if}
						</div>
						<div class="actions">
							<Button variant="ghost" on:click={() => startEdit(a)}>Edit</Button>
							<Button variant="ghost" on:click={() => remove(a.id)}>Delete</Button>
						</div>
					</div>
				</Card>
			</li>
		{/each}
	</ul>
{/if}

<p class="ats-footnote muted">
	Optional later: some ATS partners can push status updates into this list via the Foliyo Resume Spec.
	You can always update status yourself.
</p>

<style>
	.section-title {
		margin: 0 0 0.35rem;
		font-size: 1rem;
	}
	.form-hint {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		color: var(--color-muted);
		line-height: 1.45;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.label {
		font-size: 0.875rem;
		font-weight: 500;
	}
	.field-hint {
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.field-hint a {
		font-weight: 600;
	}
	select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
	}
	.more {
		margin: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: 0.65rem 0.85rem;
		background: var(--color-bg);
	}
	.more summary {
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-muted);
	}
	.more-fields {
		margin-top: 0.85rem;
	}
	.form-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.muted {
		color: var(--color-muted);
	}
	.empty {
		margin-top: 1rem;
	}
	.ats-footnote {
		margin: 1.5rem 0 0;
		font-size: 0.75rem;
		line-height: 1.45;
		max-width: 40rem;
	}
	.list {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.main {
		min-width: 0;
		flex: 1;
	}
	h2 {
		margin: 0;
		font-size: 1.0625rem;
	}
	.meta {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.pipeline {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.55rem;
		flex-wrap: wrap;
	}
	.dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--color-border);
	}
	.dot.on {
		background: #0f6b4c;
	}
	.dot.term {
		background: #b45309;
	}
	.status-text {
		font-size: 0.8125rem;
		font-weight: 500;
		margin-left: 0.35rem;
	}
	.notes {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
		white-space: pre-wrap;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
</style>
