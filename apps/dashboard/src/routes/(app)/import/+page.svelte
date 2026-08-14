<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import UpgradePrompt from '$lib/components/UpgradePrompt.svelte';
	import { isSaas } from '$lib/config';
	import { showToast } from '$lib/stores/toast';
	import { getPlan, isProPlan, type PlanInfo } from '$lib/api/plan';
	import {
		importResumeFromPdf,
		importResumeFromText,
		importResumeFromFio,
		applyImportDraft,
		getImportUpgrade,
		ImportLimitError,
		type ApplyImportResult,
		type ResumeImportDraft
	} from '$lib/api/import';
	import { ApiError } from '$lib/api/client';

	type SectionKey =
		| 'candidate'
		| 'skills'
		| 'experience'
		| 'education'
		| 'projects'
		| 'certifications'
		| 'languages'
		| 'links';

	let planInfo: PlanInfo | null = null;
	let loadingPlan = true;
	let extracting = false;
	let saving = false;
	let pasteText = '';
	let fileInput: HTMLInputElement | null = null;
	let fioInput: HTMLInputElement | null = null;
	let draft: ResumeImportDraft | null = null;
	let remainingToday: number | null = null;
	let savedResult: ApplyImportResult | null = null;
	let include: Record<SectionKey, boolean> = {
		candidate: true,
		skills: true,
		experience: true,
		education: true,
		projects: true,
		certifications: true,
		languages: true,
		links: true
	};
	let selected = {
		skills: [] as boolean[],
		experience: [] as boolean[],
		education: [] as boolean[],
		projects: [] as boolean[],
		certifications: [] as boolean[],
		languages: [] as boolean[]
	};
	let showUpgrade = false;
	let upgradeMessage =
		'AI resume is a Pro feature. Upgrade to extract a CV into your Foliyo library.';

	$: pro = isProPlan(planInfo?.plan ?? 'free');

	onMount(async () => {
		if (!isSaas) {
			loadingPlan = false;
			return;
		}
		try {
			planInfo = await getPlan();
		} catch {
			planInfo = null;
		} finally {
			loadingPlan = false;
		}
	});

	function coerceEditable(d: ResumeImportDraft): ResumeImportDraft {
		return {
			...d,
			candidate: {
				...d.candidate,
				name: d.candidate.name ?? '',
				headline: d.candidate.headline ?? '',
				bio: d.candidate.bio ?? '',
				email: d.candidate.email ?? '',
				location: d.candidate.location ?? '',
				links: d.candidate.links ?? {}
			}
		};
	}

	function initSelection(d: ResumeImportDraft) {
		selected = {
			skills: d.skills.map(() => true),
			experience: d.experience.map(() => true),
			education: d.education.map(() => true),
			projects: d.projects.map(() => true),
			certifications: d.certifications.map(() => true),
			languages: d.languages.map(() => true)
		};
		include = {
			candidate: true,
			skills: d.skills.length > 0,
			experience: d.experience.length > 0,
			education: d.education.length > 0,
			projects: d.projects.length > 0,
			certifications: d.certifications.length > 0,
			languages: d.languages.length > 0,
			links: Object.keys(d.candidate.links || {}).length > 0
		};
	}

	async function handleExtractError(err: unknown) {
		const upgrade = getImportUpgrade(err);
		if (upgrade) {
			upgradeMessage = upgrade.message;
			showUpgrade = true;
			return;
		}
		if (err instanceof ImportLimitError) {
			showToast(err.message, 'error');
			return;
		}
		if (err instanceof ApiError) {
			showToast(err.message.slice(0, 200), 'error');
			return;
		}
		showToast('Import failed', 'error');
	}

	async function extractFromPaste() {
		if (!pro) {
			showUpgrade = true;
			return;
		}
		if (pasteText.trim().length < 80) {
			showToast('Paste more resume text (at least ~80 characters)', 'error');
			return;
		}
		extracting = true;
		try {
			const res = await importResumeFromText(pasteText.trim());
			draft = coerceEditable(res.draft);
			remainingToday = res.meta.remaining_today;
			initSelection(res.draft);
			showToast('Draft ready — review before saving', 'success');
		} catch (err) {
			await handleExtractError(err);
		} finally {
			extracting = false;
		}
	}

	async function extractFromFile(file: File) {
		if (!pro) {
			showUpgrade = true;
			return;
		}
		extracting = true;
		try {
			const res = await importResumeFromPdf(file);
			draft = coerceEditable(res.draft);
			remainingToday = res.meta.remaining_today;
			initSelection(res.draft);
			showToast('Draft ready — review before saving', 'success');
		} catch (err) {
			await handleExtractError(err);
		} finally {
			extracting = false;
		}
	}

	function onFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void extractFromFile(file);
		input.value = '';
	}

	async function extractFromFio(file: File) {
		extracting = true;
		try {
			const res = await importResumeFromFio(file);
			draft = coerceEditable(res.draft);
			remainingToday = null;
			initSelection(res.draft);
			showToast('Signed .fio verified — review before saving', 'success');
		} catch (err) {
			await handleExtractError(err);
		} finally {
			extracting = false;
		}
	}

	function onFioChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void extractFromFio(file);
		input.value = '';
	}

	function pick<T>(items: T[], flags: boolean[]): T[] {
		return items.filter((_, i) => flags[i]);
	}

	/** Keep only checked sections/rows — same Foliyo Resume Spec the AI/.fio already returned. */
	function filteredDraft(): ResumeImportDraft | null {
		if (!draft) return null;
		const emptyCandidate = {
			name: '',
			headline: '',
			bio: '',
			email: '',
			location: '',
			links: {} as Record<string, string>
		};
		const links = include.links ? draft.candidate.links || {} : {};
		return {
			candidate: include.candidate
				? { ...draft.candidate, links }
				: { ...emptyCandidate, links },
			skills: include.skills ? pick(draft.skills, selected.skills) : [],
			experience: include.experience ? pick(draft.experience, selected.experience) : [],
			education: include.education ? pick(draft.education, selected.education) : [],
			projects: include.projects ? pick(draft.projects, selected.projects) : [],
			certifications: include.certifications ? pick(draft.certifications, selected.certifications) : [],
			languages: include.languages ? pick(draft.languages, selected.languages) : []
		};
	}

	const savedBreakdown: Array<{ key: keyof ApplyImportResult['saved']; label: string; href: string }> = [
		{ key: 'profile', label: 'Basics', href: '/basics' },
		{ key: 'links', label: 'Social', href: '/social' },
		{ key: 'skills', label: 'Skills', href: '/skills' },
		{ key: 'experience', label: 'Experience', href: '/experience' },
		{ key: 'education', label: 'Education', href: '/education' },
		{ key: 'projects', label: 'Projects', href: '/projects' },
		{ key: 'certifications', label: 'Certifications', href: '/certifications' },
		{ key: 'languages', label: 'Languages', href: '/languages' }
	];

	function startOver() {
		savedResult = null;
		draft = null;
		pasteText = '';
	}

	async function saveDraft() {
		const payload = filteredDraft();
		if (!payload) return;
		saving = true;
		try {
			const res = await applyImportDraft(payload);
			if (res.failed.length === 0) {
				savedResult = res;
				draft = null;
				pasteText = '';
				window.scrollTo({ top: 0, behavior: 'smooth' });
				return;
			}
			showToast(
				`Saved ${res.saved.total} item(s), ${res.failed.length} failed: ${res.failed
					.slice(0, 3)
					.map((f) => `${f.section}[${f.index}]`)
					.join(', ')}${res.failed.length > 3 ? '…' : ''}`,
				'error'
			);
		} catch (err) {
			const detail = err instanceof ApiError ? err.message.slice(0, 200) : 'failed to save';
			showToast(detail, 'error');
		} finally {
			saving = false;
		}
	}

</script>

<PageHeader
	title="AI resume"
	description={isSaas
		? 'Upload a text-based PDF or paste your CV. AI extracts a Foliyo Resume Spec draft — you review, then save into your library.'
		: 'Import a signed .fio package exported from Foliyo. Review the draft, then save into your library. Does not change login email or verification.'}
/>

{#if savedResult}
	<Card>
		<h2 class="section-title">Saved to your library</h2>
		<p class="hint">
			{savedResult.saved.total} item{savedResult.saved.total === 1 ? '' : 's'} written. Review them in
			the library, then publish a portfolio or resume.
		</p>
		<ul class="saved-list">
			{#each savedBreakdown as row}
				{#if savedResult.saved[row.key] > 0}
					<li>
						<a href={row.href}>{row.label}</a>
						<span class="muted">{savedResult.saved[row.key]}</span>
					</li>
				{/if}
			{/each}
		</ul>
		<div class="form-actions">
			<Button on:click={() => goto('/portfolios')}>Create a portfolio</Button>
			<Button variant="ghost" on:click={() => goto('/resume')}>Create a resume</Button>
			<Button variant="ghost" on:click={startOver}>Import another</Button>
		</div>
	</Card>
{:else if draft}
		<Card>
			<div class="review-head">
				<h2 class="section-title">Review draft</h2>
				{#if remainingToday != null}
					<p class="hint">{remainingToday} imports left today</p>
				{/if}
			</div>
			<p class="hint">Uncheck anything you don’t want saved. Nothing is written until you confirm. Public profile email is optional contact only — not your login.</p>

			<label class="section-toggle">
				<input type="checkbox" bind:checked={include.candidate} />
				<span>Basics (profile)</span>
			</label>
			{#if include.candidate}
				<div class="fields">
					<Input label="Name" bind:value={draft.candidate.name} />
					<Input label="Headline" bind:value={draft.candidate.headline} />
					<Input label="Email" bind:value={draft.candidate.email} />
					<Input label="Location" bind:value={draft.candidate.location} />
					<Textarea label="Bio" bind:value={draft.candidate.bio} rows={3} />
				</div>
			{/if}

			<label class="section-toggle">
				<input type="checkbox" bind:checked={include.links} />
				<span>Social links ({Object.keys(draft.candidate.links || {}).length})</span>
			</label>
			{#if include.links}
				<ul class="item-list">
					{#each Object.entries(draft.candidate.links || {}) as [k, v]}
						<li><code>{k}</code> — {v}</li>
					{/each}
				</ul>
			{/if}

			<label class="section-toggle">
				<input type="checkbox" bind:checked={include.skills} />
				<span>Skills ({draft.skills.length})</span>
			</label>
			{#if include.skills}
				<ul class="item-list">
					{#each draft.skills as s, i}
						<li>
							<label class="row-check">
								<input type="checkbox" bind:checked={selected.skills[i]} />
								{s.name}{#if s.level} · {s.level}{/if}{#if s.category} · {s.category}{/if}
							</label>
						</li>
					{/each}
				</ul>
			{/if}

			<label class="section-toggle">
				<input type="checkbox" bind:checked={include.experience} />
				<span>Experience ({draft.experience.length})</span>
			</label>
			{#if include.experience}
				<ul class="item-list">
					{#each draft.experience as e, i}
						<li>
							<label class="row-check">
								<input type="checkbox" bind:checked={selected.experience[i]} />
								<strong>{e.role}</strong> @ {e.company}
								<span class="meta">{e.start ?? '?'} – {e.current ? 'present' : e.end ?? '?'}</span>
							</label>
							{#if e.description}<p class="desc">{e.description}</p>{/if}
						</li>
					{/each}
				</ul>
			{/if}

			<label class="section-toggle">
				<input type="checkbox" bind:checked={include.education} />
				<span>Education ({draft.education.length})</span>
			</label>
			{#if include.education}
				<ul class="item-list">
					{#each draft.education as e, i}
						<li>
							<label class="row-check">
								<input type="checkbox" bind:checked={selected.education[i]} />
								{e.institution}{#if e.degree} · {e.degree}{/if}
							</label>
						</li>
					{/each}
				</ul>
			{/if}

			<label class="section-toggle">
				<input type="checkbox" bind:checked={include.projects} />
				<span>Projects ({draft.projects.length})</span>
			</label>
			{#if include.projects}
				<ul class="item-list">
					{#each draft.projects as p, i}
						<li>
							<label class="row-check">
								<input type="checkbox" bind:checked={selected.projects[i]} />
								{p.title}
							</label>
						</li>
					{/each}
				</ul>
			{/if}

			<label class="section-toggle">
				<input type="checkbox" bind:checked={include.certifications} />
				<span>Certifications ({draft.certifications.length})</span>
			</label>
			{#if include.certifications}
				<ul class="item-list">
					{#each draft.certifications as c, i}
						<li>
							<label class="row-check">
								<input type="checkbox" bind:checked={selected.certifications[i]} />
								{c.name}{#if c.issuer} · {c.issuer}{/if}
							</label>
						</li>
					{/each}
				</ul>
			{/if}

			<label class="section-toggle">
				<input type="checkbox" bind:checked={include.languages} />
				<span>Languages ({draft.languages.length})</span>
			</label>
			{#if include.languages}
				<ul class="item-list">
					{#each draft.languages as l, i}
						<li>
							<label class="row-check">
								<input type="checkbox" bind:checked={selected.languages[i]} />
								{l.language}{#if l.proficiency} · {l.proficiency}{/if}
							</label>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="form-actions">
				<Button disabled={saving} on:click={saveDraft}>
					{saving ? 'Saving…' : 'Save to library'}
				</Button>
				<Button
					variant="ghost"
					on:click={() => {
						draft = null;
					}}
				>
					Start over
				</Button>
			</div>
		</Card>
{:else if !isSaas}
	<Card>
		<h2 class="section-title">Import .fio</h2>
		<p class="hint">
			Upload a Foliyo Resume Spec package (<code>.fio</code>) exported from this or another instance
			that shares the same integrity secret. Signature is checked before you review. AI import is
			hosted-only.
		</p>
		<div class="actions-row">
			<input
				bind:this={fioInput}
				type="file"
				accept=".fio,application/vnd.foliyo.resume+zip,application/zip"
				hidden
				on:change={onFioChange}
			/>
			<Button disabled={extracting} on:click={() => fioInput?.click()}>
				{extracting ? 'Verifying…' : 'Upload .fio'}
			</Button>
		</div>
	</Card>
{:else if loadingPlan}
	<p class="muted">Loading…</p>
{:else if !pro}
	<Card>
		<p class="muted">
			AI resume is included with Pro. Upgrade to upload a PDF or paste your CV — free plans
			cannot use this feature.
		</p>
	</Card>
	<div class="upgrade-wrap">
		<UpgradePrompt
			title="Upgrade for AI import"
			message={upgradeMessage}
			pricing={planInfo?.pricing ?? null}
			billingAvailable={planInfo?.billing_available ?? false}
			on:upgraded={(e) => {
				planInfo = e.detail;
				showUpgrade = false;
			}}
		/>
	</div>
{:else if showUpgrade}
	<div class="upgrade-wrap">
		<UpgradePrompt
			title="Upgrade for AI import"
			message={upgradeMessage}
			pricing={planInfo?.pricing ?? null}
			billingAvailable={planInfo?.billing_available ?? false}
			on:upgraded={(e) => {
				planInfo = e.detail;
				showUpgrade = false;
			}}
		/>
	</div>
{:else}
		<Card>
			<h2 class="section-title">Upload or paste</h2>
			<p class="hint">
				Text-based PDFs only (max 12 pages / 4MB). No scanned/image PDFs. We check the file before
				sending anything to AI.
				{#if remainingToday != null}
					<span class="remain">{remainingToday} left today</span>
				{/if}
			</p>
			<div class="actions-row">
				<input
					bind:this={fileInput}
					type="file"
					accept="application/pdf,.pdf"
					hidden
					on:change={onFileChange}
				/>
				<Button
					disabled={extracting}
					on:click={() => fileInput?.click()}
				>
					{extracting ? 'Extracting…' : 'Upload PDF'}
				</Button>
			</div>
			<div class="or">or paste text</div>
			<Textarea
				label="Resume text"
				bind:value={pasteText}
				rows={12}
				placeholder="Paste your resume here…"
			/>
			<div class="form-actions">
				<Button disabled={extracting} on:click={extractFromPaste}>
					{extracting ? 'Extracting…' : 'Extract with AI'}
				</Button>
			</div>
		</Card>
{/if}

<style>
	.muted {
		color: var(--color-muted);
		margin: 0;
	}
	.section-title {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}
	.hint {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	.remain {
		font-weight: 600;
		color: var(--color-text);
	}
	.actions-row,
	.form-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.75rem;
	}
	.or {
		margin: 1.25rem 0 0.75rem;
		font-size: 0.8125rem;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.section-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		margin: 1rem 0 0.5rem;
	}
	.item-list {
		list-style: none;
		margin: 0 0 0.5rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.row-check {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
		font-size: 0.9rem;
	}
	.meta {
		color: var(--color-muted);
		font-size: 0.8125rem;
	}
	.desc {
		margin: 0.2rem 0 0 1.5rem;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.upgrade-wrap {
		margin-bottom: 1rem;
	}
	.review-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
		flex-wrap: wrap;
	}
	code {
		font-size: 0.85em;
	}
	.saved-list {
		list-style: none;
		margin: 0 0 0.25rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.saved-list li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.9rem;
	}
	.saved-list a {
		color: var(--color-text);
		text-decoration: none;
		font-weight: 600;
	}
	.saved-list a:hover {
		color: var(--color-primary);
	}
</style>
