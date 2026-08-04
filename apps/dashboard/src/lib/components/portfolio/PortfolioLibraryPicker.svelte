<script lang="ts">
	import type { Skill } from '$lib/api/skills';
	import type { Project } from '$lib/api/projects';
	import type { Experience } from '$lib/api/experience';
	import type { Education } from '$lib/api/education';
	import type { Certification } from '$lib/api/certifications';
	import type { Language } from '$lib/api/languages';

	export let skills: Skill[] = [];
	export let projects: Project[] = [];
	export let experiences: Experience[] = [];
	export let educations: Education[] = [];
	export let certifications: Certification[] = [];
	export let languages: Language[] = [];

	export let selectedSkills: Set<string> = new Set();
	export let selectedProjects: Set<string> = new Set();
	export let selectedExperience: Set<string> = new Set();
	export let selectedEducation: Set<string> = new Set();
	export let selectedCertifications: Set<string> = new Set();
	export let selectedLanguages: Set<string> = new Set();

	export let showSkills = true;
	export let showProjects = true;
	export let showExperience = true;
	export let showEducation = true;
	export let showCertifications = true;
	export let showLanguages = true;

	export let hint = 'Edit items under My content; select which ones appear in this portfolio.';

	type SectionId =
		| 'skills'
		| 'projects'
		| 'experience'
		| 'education'
		| 'certifications'
		| 'languages';

	/** First non-empty section starts open; others stay collapsed. */
	let openSection: SectionId | null = null;
	let filter = '';
	let initialized = false;

	$: if (!initialized) {
		const first: SectionId | null =
			skills.length > 0
				? 'skills'
				: projects.length > 0
					? 'projects'
					: experiences.length > 0
						? 'experience'
						: educations.length > 0
							? 'education'
							: certifications.length > 0
								? 'certifications'
								: languages.length > 0
									? 'languages'
									: null;
		openSection = first;
		initialized = true;
	}

	$: q = filter.trim().toLowerCase();

	$: filteredSkills = q
		? skills.filter((s) => `${s.name} ${s.level} ${s.category}`.toLowerCase().includes(q))
		: skills;
	$: filteredProjects = q
		? projects.filter((p) => `${p.title} ${p.description}`.toLowerCase().includes(q))
		: projects;
	$: filteredExperience = q
		? experiences.filter((e) => `${e.role} ${e.company}`.toLowerCase().includes(q))
		: experiences;
	$: filteredEducation = q
		? educations.filter((e) => `${e.institution} ${e.degree} ${e.field}`.toLowerCase().includes(q))
		: educations;
	$: filteredCerts = q
		? certifications.filter((c) => `${c.name} ${c.issuer}`.toLowerCase().includes(q))
		: certifications;
	$: filteredLanguages = q
		? languages.filter((l) => `${l.name} ${l.proficiency}`.toLowerCase().includes(q))
		: languages;

	$: totalSelected =
		selectedSkills.size +
		selectedProjects.size +
		selectedExperience.size +
		selectedEducation.size +
		selectedCertifications.size +
		selectedLanguages.size;

	function toggle(selected: Set<string>, id: string, checked: boolean): Set<string> {
		const next = new Set(selected);
		if (checked) next.add(id);
		else next.delete(id);
		return next;
	}

	function setAll(ids: string[], on: boolean): Set<string> {
		return on ? new Set(ids) : new Set();
	}

	function toggleSection(id: SectionId) {
		openSection = openSection === id ? null : id;
	}

	function selectVisible(
		kind: SectionId,
		visibleIds: string[],
		on: boolean
	) {
		const merge = (current: Set<string>) => {
			const next = new Set(current);
			for (const id of visibleIds) {
				if (on) next.add(id);
				else next.delete(id);
			}
			return next;
		};
		if (kind === 'skills') selectedSkills = merge(selectedSkills);
		else if (kind === 'projects') selectedProjects = merge(selectedProjects);
		else if (kind === 'experience') selectedExperience = merge(selectedExperience);
		else if (kind === 'education') selectedEducation = merge(selectedEducation);
		else if (kind === 'certifications') selectedCertifications = merge(selectedCertifications);
		else selectedLanguages = merge(selectedLanguages);
	}
</script>

<div class="picker">
	<div class="picker-head">
		<div>
			<h2 class="section-title">Include from your library</h2>
			<p class="hint">{hint}</p>
		</div>
		<p class="summary" aria-live="polite">{totalSelected} selected</p>
	</div>

	<label class="search">
		<span class="sr-only">Filter library items</span>
		<input type="search" bind:value={filter} placeholder="Filter skills, projects…" />
	</label>

	<div class="sections" role="list">
		<!-- Skills -->
		<section class="section" class:open={openSection === 'skills'} role="listitem">
			<button type="button" class="section-head" on:click={() => toggleSection('skills')}>
				<span class="chevron" aria-hidden="true">{openSection === 'skills' ? '▾' : '▸'}</span>
				<span class="section-label">Skills</span>
				<span class="counts">{selectedSkills.size}/{skills.length}</span>
			</button>
			<label class="show-toggle" on:click|stopPropagation>
				<input type="checkbox" bind:checked={showSkills} />
				Show on folio
			</label>
			{#if openSection === 'skills'}
				<div class="section-body">
					{#if skills.length === 0}
						<p class="muted">No skills yet — add some under Skills.</p>
					{:else}
						<div class="section-tools">
							<button
								type="button"
								class="linkish"
								on:click={() => selectVisible('skills', filteredSkills.map((s) => s.id), true)}
							>
								Select {q ? 'filtered' : 'all'}
							</button>
							<button
								type="button"
								class="linkish"
								on:click={() => selectVisible('skills', filteredSkills.map((s) => s.id), false)}
							>
								Clear
							</button>
							{#if !q}
								<button
									type="button"
									class="linkish"
									on:click={() => (selectedSkills = setAll(skills.map((s) => s.id), true))}
								>
									All
								</button>
							{/if}
						</div>
						{#if filteredSkills.length === 0}
							<p class="muted">No matches.</p>
						{:else}
							<ul class="check-list chips">
								{#each filteredSkills as s (s.id)}
									<li>
										<label class="chip" class:on={selectedSkills.has(s.id)}>
											<input
												type="checkbox"
												checked={selectedSkills.has(s.id)}
												on:change={(e) =>
													(selectedSkills = toggle(
														selectedSkills,
														s.id,
														e.currentTarget.checked
													))}
											/>
											<span class="chip-text"
												>{s.name}<span class="meta">{s.level}</span></span
											>
										</label>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
			{/if}
		</section>

		<!-- Projects -->
		<section class="section" class:open={openSection === 'projects'} role="listitem">
			<button type="button" class="section-head" on:click={() => toggleSection('projects')}>
				<span class="chevron" aria-hidden="true">{openSection === 'projects' ? '▾' : '▸'}</span>
				<span class="section-label">Projects</span>
				<span class="counts">{selectedProjects.size}/{projects.length}</span>
			</button>
			<label class="show-toggle" on:click|stopPropagation>
				<input type="checkbox" bind:checked={showProjects} />
				Show on folio
			</label>
			{#if openSection === 'projects'}
				<div class="section-body">
					{#if projects.length === 0}
						<p class="muted">No projects yet — add some under Projects.</p>
					{:else}
						<div class="section-tools">
							<button
								type="button"
								class="linkish"
								on:click={() =>
									selectVisible(
										'projects',
										filteredProjects.map((p) => p.id),
										true
									)}
							>
								Select {q ? 'filtered' : 'all'}
							</button>
							<button
								type="button"
								class="linkish"
								on:click={() =>
									selectVisible(
										'projects',
										filteredProjects.map((p) => p.id),
										false
									)}
							>
								Clear
							</button>
						</div>
						{#if filteredProjects.length === 0}
							<p class="muted">No matches.</p>
						{:else}
							<ul class="check-list scroll">
								{#each filteredProjects as p (p.id)}
									<li>
										<label class="row">
											<input
												type="checkbox"
												checked={selectedProjects.has(p.id)}
												on:change={(e) =>
													(selectedProjects = toggle(
														selectedProjects,
														p.id,
														e.currentTarget.checked
													))}
											/>
											<span class="row-text">{p.title}</span>
										</label>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
			{/if}
		</section>

		<!-- Experience -->
		<section class="section" class:open={openSection === 'experience'} role="listitem">
			<button type="button" class="section-head" on:click={() => toggleSection('experience')}>
				<span class="chevron" aria-hidden="true">{openSection === 'experience' ? '▾' : '▸'}</span>
				<span class="section-label">Experience</span>
				<span class="counts">{selectedExperience.size}/{experiences.length}</span>
			</button>
			<label class="show-toggle" on:click|stopPropagation>
				<input type="checkbox" bind:checked={showExperience} />
				Show on folio
			</label>
			{#if openSection === 'experience'}
				<div class="section-body">
					{#if experiences.length === 0}
						<p class="muted">No experience yet — add some under Experience.</p>
					{:else}
						<div class="section-tools">
							<button
								type="button"
								class="linkish"
								on:click={() =>
									selectVisible(
										'experience',
										filteredExperience.map((e) => e.id),
										true
									)}
							>
								Select {q ? 'filtered' : 'all'}
							</button>
							<button
								type="button"
								class="linkish"
								on:click={() =>
									selectVisible(
										'experience',
										filteredExperience.map((e) => e.id),
										false
									)}
							>
								Clear
							</button>
						</div>
						{#if filteredExperience.length === 0}
							<p class="muted">No matches.</p>
						{:else}
							<ul class="check-list scroll">
								{#each filteredExperience as e (e.id)}
									<li>
										<label class="row">
											<input
												type="checkbox"
												checked={selectedExperience.has(e.id)}
												on:change={(ev) =>
													(selectedExperience = toggle(
														selectedExperience,
														e.id,
														ev.currentTarget.checked
													))}
											/>
											<span class="row-text">{e.role} at {e.company}</span>
										</label>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
			{/if}
		</section>

		<!-- Education -->
		<section class="section" class:open={openSection === 'education'} role="listitem">
			<button type="button" class="section-head" on:click={() => toggleSection('education')}>
				<span class="chevron" aria-hidden="true">{openSection === 'education' ? '▾' : '▸'}</span>
				<span class="section-label">Education</span>
				<span class="counts">{selectedEducation.size}/{educations.length}</span>
			</button>
			<label class="show-toggle" on:click|stopPropagation>
				<input type="checkbox" bind:checked={showEducation} />
				Show on folio
			</label>
			{#if openSection === 'education'}
				<div class="section-body">
					{#if educations.length === 0}
						<p class="muted">No education yet — add some under Education.</p>
					{:else}
						<div class="section-tools">
							<button
								type="button"
								class="linkish"
								on:click={() =>
									selectVisible(
										'education',
										filteredEducation.map((e) => e.id),
										true
									)}
							>
								Select {q ? 'filtered' : 'all'}
							</button>
							<button
								type="button"
								class="linkish"
								on:click={() =>
									selectVisible(
										'education',
										filteredEducation.map((e) => e.id),
										false
									)}
							>
								Clear
							</button>
						</div>
						{#if filteredEducation.length === 0}
							<p class="muted">No matches.</p>
						{:else}
							<ul class="check-list scroll">
								{#each filteredEducation as e (e.id)}
									<li>
										<label class="row">
											<input
												type="checkbox"
												checked={selectedEducation.has(e.id)}
												on:change={(ev) =>
													(selectedEducation = toggle(
														selectedEducation,
														e.id,
														ev.currentTarget.checked
													))}
											/>
											<span class="row-text">{e.institution}</span>
										</label>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
			{/if}
		</section>

		<!-- Certifications -->
		<section class="section" class:open={openSection === 'certifications'} role="listitem">
			<button type="button" class="section-head" on:click={() => toggleSection('certifications')}>
				<span class="chevron" aria-hidden="true"
					>{openSection === 'certifications' ? '▾' : '▸'}</span
				>
				<span class="section-label">Certifications</span>
				<span class="counts">{selectedCertifications.size}/{certifications.length}</span>
			</button>
			<label class="show-toggle" on:click|stopPropagation>
				<input type="checkbox" bind:checked={showCertifications} />
				Show on folio
			</label>
			{#if openSection === 'certifications'}
				<div class="section-body">
					{#if certifications.length === 0}
						<p class="muted">No certifications yet — add some under Certifications.</p>
					{:else}
						<div class="section-tools">
							<button
								type="button"
								class="linkish"
								on:click={() =>
									selectVisible(
										'certifications',
										filteredCerts.map((c) => c.id),
										true
									)}
							>
								Select {q ? 'filtered' : 'all'}
							</button>
							<button
								type="button"
								class="linkish"
								on:click={() =>
									selectVisible(
										'certifications',
										filteredCerts.map((c) => c.id),
										false
									)}
							>
								Clear
							</button>
						</div>
						{#if filteredCerts.length === 0}
							<p class="muted">No matches.</p>
						{:else}
							<ul class="check-list scroll">
								{#each filteredCerts as c (c.id)}
									<li>
										<label class="row">
											<input
												type="checkbox"
												checked={selectedCertifications.has(c.id)}
												on:change={(ev) =>
													(selectedCertifications = toggle(
														selectedCertifications,
														c.id,
														ev.currentTarget.checked
													))}
											/>
											<span class="row-text"
												>{c.name}{#if c.issuer}<span class="meta"> · {c.issuer}</span
												>{/if}</span
											>
										</label>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
			{/if}
		</section>

		<!-- Languages -->
		<section class="section" class:open={openSection === 'languages'} role="listitem">
			<button type="button" class="section-head" on:click={() => toggleSection('languages')}>
				<span class="chevron" aria-hidden="true">{openSection === 'languages' ? '▾' : '▸'}</span>
				<span class="section-label">Languages</span>
				<span class="counts">{selectedLanguages.size}/{languages.length}</span>
			</button>
			<label class="show-toggle" on:click|stopPropagation>
				<input type="checkbox" bind:checked={showLanguages} />
				Show on folio
			</label>
			{#if openSection === 'languages'}
				<div class="section-body">
					{#if languages.length === 0}
						<p class="muted">No languages yet — add some under Languages.</p>
					{:else}
						<div class="section-tools">
							<button
								type="button"
								class="linkish"
								on:click={() =>
									selectVisible(
										'languages',
										filteredLanguages.map((l) => l.id),
										true
									)}
							>
								Select {q ? 'filtered' : 'all'}
							</button>
							<button
								type="button"
								class="linkish"
								on:click={() =>
									selectVisible(
										'languages',
										filteredLanguages.map((l) => l.id),
										false
									)}
							>
								Clear
							</button>
						</div>
						{#if filteredLanguages.length === 0}
							<p class="muted">No matches.</p>
						{:else}
							<ul class="check-list chips">
								{#each filteredLanguages as l (l.id)}
									<li>
										<label class="chip" class:on={selectedLanguages.has(l.id)}>
											<input
												type="checkbox"
												checked={selectedLanguages.has(l.id)}
												on:change={(ev) =>
													(selectedLanguages = toggle(
														selectedLanguages,
														l.id,
														ev.currentTarget.checked
													))}
											/>
											<span class="chip-text"
												>{l.name}<span class="meta">{l.proficiency}</span></span
											>
										</label>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.picker-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.section-title {
		margin: 0 0 0.25rem;
		font-size: 1rem;
	}
	.hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
		max-width: 36rem;
	}
	.summary {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-primary);
		white-space: nowrap;
	}
	.search input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg, var(--color-surface));
		font-size: 0.875rem;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
	.sections {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: calc(var(--radius) + 2px);
		overflow: hidden;
		background: var(--color-surface);
	}
	.section {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		column-gap: 0.5rem;
		border-bottom: 1px solid var(--color-border);
	}
	.section:last-child {
		border-bottom: 0;
	}
	.section.open {
		background: color-mix(in srgb, var(--color-primary-light) 35%, var(--color-surface));
	}
	.section-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 0.75rem;
		border: 0;
		background: transparent;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: inherit;
		min-width: 0;
	}
	.section-head:hover {
		background: color-mix(in srgb, var(--color-bg) 70%, transparent);
	}
	.chevron {
		width: 1rem;
		color: var(--color-muted);
		font-size: 0.75rem;
	}
	.section-label {
		font-size: 0.9rem;
		font-weight: 600;
		flex: 1;
		min-width: 0;
	}
	.counts {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}
	.show-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding-right: 0.75rem;
		font-size: 0.75rem;
		color: var(--color-muted);
		white-space: nowrap;
		cursor: pointer;
	}
	.section-body {
		grid-column: 1 / -1;
		padding: 0 0.75rem 0.75rem;
		border-top: 1px dashed var(--color-border);
	}
	.section-tools {
		display: flex;
		gap: 0.75rem;
		margin: 0.55rem 0 0.45rem;
	}
	.linkish {
		border: 0;
		background: none;
		padding: 0;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-primary);
		cursor: pointer;
	}
	.linkish:hover {
		text-decoration: underline;
	}
	.check-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.check-list.scroll {
		max-height: 14rem;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding-right: 0.25rem;
	}
	.check-list.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		max-height: 12rem;
		overflow: auto;
	}
	.row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.35rem 0.4rem;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.row:hover {
		background: var(--color-bg);
	}
	.row-text {
		min-width: 0;
		line-height: 1.35;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		font-size: 0.8125rem;
		cursor: pointer;
		background: var(--color-bg, #fff);
	}
	.chip input {
		accent-color: var(--color-primary);
	}
	.chip.on {
		border-color: var(--color-primary);
		background: var(--color-primary-light);
	}
	.chip-text {
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
	}
	.meta {
		color: var(--color-muted);
		font-size: 0.75rem;
	}
	.muted {
		margin: 0.5rem 0 0;
		color: var(--color-muted);
		font-size: 0.8125rem;
	}
</style>
