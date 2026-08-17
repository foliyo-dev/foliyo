<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
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
		listImportSnapshots,
		restoreImportSnapshot,
		deleteImportSnapshot,
		getImportUpgrade,
		ImportLimitError,
		type ApplyImportResult,
		type ImportSnapshot,
		type ResumeImportDraft
	} from '$lib/api/import';
	import { ApiError } from '$lib/api/client';
	import { requestConfirm } from '$lib/stores/confirm';
	import { listSkills } from '$lib/api/skills';
	import { listExperience } from '$lib/api/experience';
	import { listEducation } from '$lib/api/education';
	import { listProjects } from '$lib/api/projects';
	import { listCertifications } from '$lib/api/certifications';
	import { listLanguages } from '$lib/api/languages';
	import { listSocialLinks } from '$lib/api/social';
	import {
		certificationKey,
		dupCount,
		educationKey,
		emptyDupFlags,
		emptyLibraryIndex,
		experienceKey,
		languageKey,
		matchDraftAgainstLibrary,
		projectKey,
		rememberLink,
		skillKey,
		type ImportDupFlags,
		type ImportLibraryIndex
	} from '$lib/utils/importMatch';

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
	let snapshots: ImportSnapshot[] = [];
	let snapshotLimit = 5;
	let snapshotBusyId: string | null = null;
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
		languages: [] as boolean[],
		links: [] as boolean[]
	};
	let libraryIndex: ImportLibraryIndex = emptyLibraryIndex();
	let dup: ImportDupFlags = emptyDupFlags();
	let showUpgrade = false;
	let upgradeMessage =
		'Import resume is a Pro feature. Upgrade to extract a CV into your Foliyo library.';

	$: pro = isProPlan(planInfo?.plan ?? 'free');
	$: onboarding = $page.url.searchParams.get('onboarding') === '1';
	$: importPhase = savedResult ? 3 : draft ? 2 : 1;

	onMount(async () => {
		void loadSnapshots();
		void loadLibraryIndex();
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

	async function loadLibraryIndex() {
		try {
			const [skills, experience, education, projects, certs, languages, social] =
				await Promise.all([
					listSkills('confirmed').catch(() => []),
					listExperience().catch(() => []),
					listEducation().catch(() => []),
					listProjects().catch(() => []),
					listCertifications().catch(() => []),
					listLanguages().catch(() => []),
					listSocialLinks().catch(() => [])
				]);
			const next = emptyLibraryIndex();
			for (const s of skills) next.skills.add(skillKey(s.name));
			for (const e of experience) next.experience.add(experienceKey(e.company, e.role, e.start_date));
			for (const e of education) next.education.add(educationKey(e.institution, e.degree));
			for (const p of projects) next.projects.add(projectKey(p.title, p.url, p.repo_url));
			for (const c of certs) next.certifications.add(certificationKey(c.name, c.issuer));
			for (const l of languages) next.languages.add(languageKey(l.name));
			for (const l of social) rememberLink(next.links, l.provider, l.value);
			libraryIndex = next;
			if (draft) applyDuplicateFlags(draft);
		} catch {
			libraryIndex = emptyLibraryIndex();
		}
	}

	function applyDuplicateFlags(d: ResumeImportDraft) {
		dup = matchDraftAgainstLibrary(d, libraryIndex);
		selected = {
			skills: d.skills.map((_, i) => !dup.skills[i]),
			experience: d.experience.map((_, i) => !dup.experience[i]),
			education: d.education.map((_, i) => !dup.education[i]),
			projects: d.projects.map((_, i) => !dup.projects[i]),
			certifications: d.certifications.map((_, i) => !dup.certifications[i]),
			languages: d.languages.map((_, i) => !dup.languages[i]),
			links: Object.keys(d.candidate.links || {}).map((_, i) => !dup.links[i])
		};
	}

	async function loadSnapshots() {
		try {
			const res = await listImportSnapshots();
			snapshots = res.items;
			snapshotLimit = res.limit;
		} catch {
			snapshots = [];
		}
	}

	function formatSnapshotDate(iso: string) {
		const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleString(undefined, {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function restoreSnapshot(s: ImportSnapshot) {
		const ok = await requestConfirm({
			title: 'Restore library from this snapshot?',
			message:
				'Your current active library (skills, projects, experience, …) will be replaced with what was saved before that import. Portfolios and resumes stay. This cannot be undone except by another snapshot.',
			confirmLabel: 'Restore library'
		});
		if (!ok) return;
		snapshotBusyId = s.id;
		try {
			await restoreImportSnapshot(s.id);
			showToast('Library restored from snapshot', 'success');
			savedResult = null;
			draft = null;
			await Promise.all([loadSnapshots(), loadLibraryIndex()]);
		} catch (err) {
			const detail = err instanceof ApiError ? err.message.slice(0, 200) : 'Restore failed';
			showToast(detail, 'error');
		} finally {
			snapshotBusyId = null;
		}
	}

	async function removeSnapshot(s: ImportSnapshot) {
		const ok = await requestConfirm({
			title: 'Delete this snapshot?',
			message: 'You will no longer be able to restore to this point.',
			confirmLabel: 'Delete snapshot'
		});
		if (!ok) return;
		snapshotBusyId = s.id;
		try {
			await deleteImportSnapshot(s.id);
			snapshots = snapshots.filter((x) => x.id !== s.id);
			showToast('Snapshot deleted', 'success');
		} catch {
			showToast('Failed to delete snapshot', 'error');
		} finally {
			snapshotBusyId = null;
		}
	}

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
		applyDuplicateFlags(d);
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
			initSelection(draft);
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
			initSelection(draft);
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
			initSelection(draft);
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
		const links = include.links
			? Object.fromEntries(
					Object.entries(draft.candidate.links || {}).filter((_, i) => selected.links[i])
				)
			: {};
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
		dup = emptyDupFlags();
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
				dup = emptyDupFlags();
				pasteText = '';
				window.scrollTo({ top: 0, behavior: 'smooth' });
				await Promise.all([loadSnapshots(), loadLibraryIndex()]);
				if (res.saved.total === 0 && (res.skipped?.total ?? 0) > 0) {
					showToast('Nothing new — those items are already in your library', 'success');
				} else if (res.snapshot) {
					showToast('Library saved — undo point kept in Import history', 'success');
				}
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
	title="Import resume"
	description={isSaas
		? 'Step through: add your resume → review the extraction → save to your library. Each save keeps an undo snapshot (up to 5).'
		: 'Import a signed .fio package. Review the draft, then save into your library. Each save keeps an undo snapshot (up to 5).'}
/>

{#if onboarding}
	<ol class="import-steps" aria-label="Import progress">
		<li class:current={importPhase === 1} class:done={importPhase > 1}>1. Add resume</li>
		<li class:current={importPhase === 2} class:done={importPhase > 2}>2. Review extraction</li>
		<li class:current={importPhase === 3}>3. Save to library</li>
	</ol>
{/if}

{#if snapshots.length > 0 && !draft}
	<details class="history" open={Boolean(savedResult)}>
		<summary>Import history ({snapshots.length}/{snapshotLimit})</summary>
		<p class="hint history-hint">
			Each successful import saves your library first. Restore replaces today’s active library with that
			snapshot — portfolios and resumes stay.
		</p>
		<ul class="history-list">
			{#each snapshots as s (s.id)}
				<li>
					<div class="history-meta">
						<strong>{s.label}</strong>
						<span class="muted">{formatSnapshotDate(s.created_at)}</span>
					</div>
					<div class="form-actions history-actions">
						<Button
							variant="ghost"
							disabled={snapshotBusyId === s.id}
							on:click={() => restoreSnapshot(s)}
						>
							Restore
						</Button>
						<Button
							variant="ghost"
							disabled={snapshotBusyId === s.id}
							on:click={() => removeSnapshot(s)}
						>
							Delete
						</Button>
					</div>
				</li>
			{/each}
		</ul>
	</details>
{/if}

{#if savedResult}
	<Card>
		<h2 class="section-title">
			{savedResult.saved.total === 0 ? 'Nothing new to save' : 'Saved to your library'}
		</h2>
		<p class="hint">
			{#if savedResult.saved.total === 0}
				{(savedResult.skipped?.total ?? 0) > 0
					? `${savedResult.skipped?.total} item${savedResult.skipped?.total === 1 ? ' was' : 's were'} already in your library.`
					: 'No items were selected.'}
			{:else}
				{savedResult.saved.total} item{savedResult.saved.total === 1 ? '' : 's'} written.
				{#if (savedResult.skipped?.total ?? 0) > 0}
					{savedResult.skipped?.total} already in your library — not added again.
				{/if}
			{/if}
			{#if onboarding && savedResult.saved.total > 0}
				Next: review what landed, then create your default portfolio.
			{:else if savedResult.saved.total > 0}
				Review them in the library, then publish a portfolio or resume.
			{/if}
		</p>
		<ul class="saved-list">
			{#each savedBreakdown as row}
				{#if savedResult.saved[row.key] > 0}
					<li>
						<a href={row.href}>{row.label}</a>
						<span class="muted">{savedResult.saved[row.key]} new</span>
					</li>
				{/if}
			{/each}
		</ul>
		<div class="form-actions">
			{#if onboarding}
				<Button on:click={() => goto('/basics')}>Review library</Button>
				<Button variant="secondary" on:click={() => goto('/portfolios')}>Create default portfolio</Button>
				<Button variant="ghost" on:click={() => goto('/')}>Back to Overview</Button>
			{:else}
				<Button on:click={() => goto('/portfolios')}>Create a portfolio</Button>
				<Button variant="secondary" on:click={() => goto('/resume/new')}>Create a resume</Button>
				<Button variant="ghost" on:click={startOver}>Import another</Button>
			{/if}
		</div>
	</Card>
{:else if draft}
		<Card>
			<div class="review-head">
				<h2 class="section-title">{onboarding ? '2. Review extraction' : 'Review draft'}</h2>
				{#if remainingToday != null}
					<p class="hint">{remainingToday} imports left today</p>
				{/if}
			</div>
			<p class="hint">
				Uncheck anything you don’t want saved. Nothing is written until you confirm. Public profile
				email is optional contact only — not your login.
				{#if dupCount(dup) > 0}
					{@const n = dupCount(dup)}
					{n} item{n === 1 ? '' : 's'} already in your library
					{n === 1 ? ' is' : ' are'} unchecked.
				{/if}
			</p>

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
					{#each Object.entries(draft.candidate.links || {}) as [k, v], i}
						<li>
							<label class="row-check">
								<input type="checkbox" bind:checked={selected.links[i]} />
								<code>{k}</code> — {v}
								{#if dup.links[i]}<span class="dup-badge">Already in library</span>{/if}
							</label>
						</li>
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
								{#if dup.skills[i]}<span class="dup-badge">Already in library</span>{/if}
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
								{#if dup.experience[i]}<span class="dup-badge">Already in library</span>{/if}
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
								{#if dup.education[i]}<span class="dup-badge">Already in library</span>{/if}
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
								{#if dup.projects[i]}<span class="dup-badge">Already in library</span>{/if}
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
								{#if dup.certifications[i]}<span class="dup-badge">Already in library</span>{/if}
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
								{#if dup.languages[i]}<span class="dup-badge">Already in library</span>{/if}
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
					variant="secondary"
					on:click={() => {
						draft = null;
						dup = emptyDupFlags();
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
			Import resume is included with Pro. Upgrade to upload a PDF or paste your CV — free plans
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
			<h2 class="section-title">{onboarding ? '1. Add resume' : 'Upload or paste'}</h2>
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
	.import-steps {
		list-style: none;
		margin: 0 0 1.25rem;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-muted);
	}
	.import-steps li.current {
		color: var(--color-primary);
	}
	.import-steps li.done {
		color: #166534;
	}
	.history {
		margin: 0 0 1.25rem;
		padding: 0.85rem 1rem;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
	}
	.history summary {
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-muted);
	}
	.history-hint {
		margin-top: 0.5rem;
	}
	.history-list {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.history-list li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		padding: 0.5rem 0;
		border-top: 1px solid var(--color-border);
	}
	.history-meta {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.history-meta strong {
		font-size: 0.875rem;
	}
	.history-actions {
		margin-top: 0;
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
	.dup-badge {
		font-size: 0.6875rem;
		font-weight: 600;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		background: var(--color-bg);
		color: var(--color-muted);
		border: 1px solid var(--color-border);
		white-space: nowrap;
	}
</style>
