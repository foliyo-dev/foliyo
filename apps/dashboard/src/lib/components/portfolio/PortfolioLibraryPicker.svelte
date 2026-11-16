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
	export let showPosts = true;

	export let skillsTitle = '';
	export let projectsTitle = '';
	export let experienceTitle = '';
	export let educationTitle = '';
	export let certificationsTitle = '';
	export let languagesTitle = '';
	export let postsTitle = '';

	/** When false, hide per-section “Show on portfolio” toggles (e.g. resume Custom). */
	export let showSectionVisibility = true;
	/** Hide Writing/posts when editing a resume (posts are portfolio-only). */
	export let showPostsSection = true;

	export let title = 'Choose what visitors will see';
	export let hint = 'Edit items under My Library; select which ones appear in this portfolio.';

	type SectionId =
		| 'skills'
		| 'projects'
		| 'experience'
		| 'education'
		| 'certifications'
		| 'languages';

	type SectionIcon = 'spark' | 'folder' | 'briefcase' | 'grad' | 'award' | 'lang' | 'pen';

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

	function selectVisible(kind: SectionId, visibleIds: string[], on: boolean) {
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

	function countTone(selected: number, total: number): 'empty' | 'full' | 'partial' {
		if (total > 0 && selected === 0) return 'empty';
		if (total > 0 && selected === total) return 'full';
		return 'partial';
	}
</script>

{#snippet sectionIcon(name: SectionIcon)}
	<span class="section-icon" aria-hidden="true" data-icon={name}>
		{#if name === 'spark'}
			<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
				><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" /></svg
			>
		{:else if name === 'folder'}
			<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
				><path d="M2.5 4.5h4l1.5 1.5h5.5v7H2.5v-8.5z" /></svg
			>
		{:else if name === 'briefcase'}
			<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
				><rect x="2" y="5" width="12" height="8.5" rx="1" /><path d="M6 5V3.5h4V5M2 8.5h12" /></svg
			>
		{:else if name === 'grad'}
			<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
				><path d="M1.5 7 8 4l6.5 3L8 10 1.5 7zM4 8.5v3L8 13.5l4-2v-3" /></svg
			>
		{:else if name === 'award'}
			<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
				><circle cx="8" cy="6.5" r="3.5" /><path d="M6 9.5 5 14l3-1.5L11 14l-1-4.5" /></svg
			>
		{:else if name === 'lang'}
			<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
				><circle cx="8" cy="8" r="5.5" /><path
					d="M2.5 8h11M8 2.5c1.5 1.8 2.2 3.5 2.2 5.5S9.5 11.7 8 13.5M8 2.5C6.5 4.3 5.8 6 5.8 8s.7 3.7 2.2 5.5"
				/></svg
			>
		{:else}
			<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
				><path d="M9.5 3.5 12.5 6.5 6 13H3v-3l6.5-6.5z" /></svg
			>
		{/if}
	</span>
{/snippet}

{#snippet countChip(selected: number, total: number)}
	<span
		class="count-chip"
		class:dim={countTone(selected, total) === 'empty'}
		class:full={countTone(selected, total) === 'full'}
	>
		{selected}/{total}
	</span>
{/snippet}

{#snippet manageBtn(href: string)}
	<a class="manage-btn" {href} on:click|stopPropagation>
		<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"
			><path d="M9.5 3.5 12.5 6.5 6 13H3v-3l6.5-6.5z" /></svg
		>
		Manage
	</a>
{/snippet}

<div class="picker">
	<div class="picker-head">
		<div>
			<h2 class="section-title">{title}</h2>
			<p class="hint">{hint}</p>
		</div>
		<p class="summary" aria-live="polite">{totalSelected} selected</p>
	</div>

	<label class="search">
		<span class="sr-only">Filter library items</span>
		<input type="search" bind:value={filter} placeholder="Filter skills, projects…" />
	</label>

	<div class="sections" class:no-visibility={!showSectionVisibility} role="list">
		<!-- Skills -->
		<section class="section" class:open={openSection === 'skills'} role="listitem">
			<button type="button" class="section-head" on:click={() => toggleSection('skills')}>
				<span class="chevron" aria-hidden="true">{openSection === 'skills' ? '▾' : '▸'}</span>
				{@render sectionIcon('spark')}
				<span class="section-label">{skillsTitle.trim() || 'Skills'}</span>
				{@render countChip(selectedSkills.size, skills.length)}
			</button>
			<div class="section-aside">
				{#if showSectionVisibility}
					<label
						class="vis-switch"
						title="Show on portfolio"
						on:click|stopPropagation
					>
						<input
							type="checkbox"
							bind:checked={showSkills}
							aria-label="Show Skills on portfolio"
						/>
						<span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
					</label>
				{/if}
				{@render manageBtn('/skills')}
			</div>
			{#if openSection === 'skills'}
				<div class="section-body">
					{#if showSectionVisibility}
						<label class="title-field">
							<span class="title-field-label">Section title</span>
							<input
								class="title-override"
								type="text"
								maxlength="40"
								placeholder="Custom heading"
								bind:value={skillsTitle}
								aria-label="Skills section title"
							/>
						</label>
					{/if}
					{#if skills.length === 0}
						<p class="muted">No skills yet — <a href="/skills">add some under Skills</a>.</p>
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
				{@render sectionIcon('folder')}
				<span class="section-label">{projectsTitle.trim() || 'Projects'}</span>
				{@render countChip(selectedProjects.size, projects.length)}
			</button>
			<div class="section-aside">
				{#if showSectionVisibility}
					<label
						class="vis-switch"
						title="Show on portfolio"
						on:click|stopPropagation
					>
						<input
							type="checkbox"
							bind:checked={showProjects}
							aria-label="Show Projects on portfolio"
						/>
						<span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
					</label>
				{/if}
				{@render manageBtn('/projects')}
			</div>
			{#if openSection === 'projects'}
				<div class="section-body">
					{#if showSectionVisibility}
						<label class="title-field">
							<span class="title-field-label">Section title</span>
							<input
								class="title-override"
								type="text"
								maxlength="40"
								placeholder="Custom heading"
								bind:value={projectsTitle}
								aria-label="Projects section title"
							/>
						</label>
					{/if}
					{#if projects.length === 0}
						<p class="muted">No projects yet — <a href="/projects">add some under Projects</a>.</p>
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
				{@render sectionIcon('briefcase')}
				<span class="section-label">{experienceTitle.trim() || 'Experience'}</span>
				{@render countChip(selectedExperience.size, experiences.length)}
			</button>
			<div class="section-aside">
				{#if showSectionVisibility}
					<label
						class="vis-switch"
						title="Show on portfolio"
						on:click|stopPropagation
					>
						<input
							type="checkbox"
							bind:checked={showExperience}
							aria-label="Show Experience on portfolio"
						/>
						<span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
					</label>
				{/if}
				{@render manageBtn('/experience')}
			</div>
			{#if openSection === 'experience'}
				<div class="section-body">
					{#if showSectionVisibility}
						<label class="title-field">
							<span class="title-field-label">Section title</span>
							<input
								class="title-override"
								type="text"
								maxlength="40"
								placeholder="Custom heading"
								bind:value={experienceTitle}
								aria-label="Experience section title"
							/>
						</label>
					{/if}
					{#if experiences.length === 0}
						<p class="muted"
							>No experience yet — <a href="/experience">add some under Experience</a>.</p
						>
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
				{@render sectionIcon('grad')}
				<span class="section-label">{educationTitle.trim() || 'Education'}</span>
				{@render countChip(selectedEducation.size, educations.length)}
			</button>
			<div class="section-aside">
				{#if showSectionVisibility}
					<label
						class="vis-switch"
						title="Show on portfolio"
						on:click|stopPropagation
					>
						<input
							type="checkbox"
							bind:checked={showEducation}
							aria-label="Show Education on portfolio"
						/>
						<span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
					</label>
				{/if}
				{@render manageBtn('/education')}
			</div>
			{#if openSection === 'education'}
				<div class="section-body">
					{#if showSectionVisibility}
						<label class="title-field">
							<span class="title-field-label">Section title</span>
							<input
								class="title-override"
								type="text"
								maxlength="40"
								placeholder="Custom heading"
								bind:value={educationTitle}
								aria-label="Education section title"
							/>
						</label>
					{/if}
					{#if educations.length === 0}
						<p class="muted"
							>No education yet — <a href="/education">add some under Education</a>.</p
						>
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
				{@render sectionIcon('award')}
				<span class="section-label">{certificationsTitle.trim() || 'Certifications'}</span>
				{@render countChip(selectedCertifications.size, certifications.length)}
			</button>
			<div class="section-aside">
				{#if showSectionVisibility}
					<label
						class="vis-switch"
						title="Show on portfolio"
						on:click|stopPropagation
					>
						<input
							type="checkbox"
							bind:checked={showCertifications}
							aria-label="Show Certifications on portfolio"
						/>
						<span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
					</label>
				{/if}
				{@render manageBtn('/certifications')}
			</div>
			{#if openSection === 'certifications'}
				<div class="section-body">
					{#if showSectionVisibility}
						<label class="title-field">
							<span class="title-field-label">Section title</span>
							<input
								class="title-override"
								type="text"
								maxlength="40"
								placeholder="Custom heading"
								bind:value={certificationsTitle}
								aria-label="Certifications section title"
							/>
						</label>
					{/if}
					{#if certifications.length === 0}
						<p class="muted"
							>No certifications yet —
							<a href="/certifications">add some under Certifications</a>.</p
						>
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
				{@render sectionIcon('lang')}
				<span class="section-label">{languagesTitle.trim() || 'Languages'}</span>
				{@render countChip(selectedLanguages.size, languages.length)}
			</button>
			<div class="section-aside">
				{#if showSectionVisibility}
					<label
						class="vis-switch"
						title="Show on portfolio"
						on:click|stopPropagation
					>
						<input
							type="checkbox"
							bind:checked={showLanguages}
							aria-label="Show Languages on portfolio"
						/>
						<span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
					</label>
				{/if}
				{@render manageBtn('/languages')}
			</div>
			{#if openSection === 'languages'}
				<div class="section-body">
					{#if showSectionVisibility}
						<label class="title-field">
							<span class="title-field-label">Section title</span>
							<input
								class="title-override"
								type="text"
								maxlength="40"
								placeholder="Custom heading"
								bind:value={languagesTitle}
								aria-label="Languages section title"
							/>
						</label>
					{/if}
					{#if languages.length === 0}
						<p class="muted"
							>No languages yet — <a href="/languages">add some under Languages</a>.</p
						>
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

		{#if showPostsSection && showSectionVisibility}
			<!-- Writing: on/off only — posts are managed under Blog -->
			<section class="section writing-toggle" role="listitem">
				<div class="section-head writing-head">
					<span class="chevron spacer" aria-hidden="true"></span>
					{@render sectionIcon('pen')}
					<span class="section-label">{postsTitle.trim() || 'Writing'}</span>
					<span class="writing-hint muted"
						>Links to your <a href="/blog">blog</a></span
					>
				</div>
				<div class="section-aside">
					<label class="vis-switch" title="Show on portfolio">
						<input type="checkbox" bind:checked={showPosts} aria-label="Show Writing on portfolio" />
						<span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
					</label>
					{@render manageBtn('/blog')}
				</div>
				<div class="section-body writing-body">
					<label class="title-field">
						<span class="title-field-label">Section title</span>
						<input
							class="title-override"
							type="text"
							maxlength="40"
							placeholder="Custom heading"
							bind:value={postsTitle}
							aria-label="Writing nav label"
						/>
					</label>
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	.writing-toggle {
		align-items: center;
	}
	.writing-head {
		cursor: default;
		flex-wrap: wrap;
		row-gap: 0.15rem;
	}
	.writing-head:hover {
		background: transparent;
	}
	.writing-hint {
		flex-basis: 100%;
		margin-left: calc(1rem + 1.75rem + 0.5rem);
		font-size: 0.75rem;
		font-weight: 400;
	}
	.chevron.spacer {
		visibility: hidden;
	}
	.writing-body {
		border-top: 1px dashed var(--color-border);
		padding-top: 0.55rem;
	}
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
		gap: 0.45rem;
		background: transparent;
	}
	.section {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		column-gap: 0.5rem;
		border: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent);
		border-radius: var(--radius);
		background: var(--color-surface);
	}
	.sections.no-visibility .section {
		grid-template-columns: 1fr auto;
	}
	.section.open {
		background: color-mix(in srgb, var(--color-primary-light) 28%, var(--color-surface));
		border-color: color-mix(in srgb, var(--color-primary) 22%, var(--color-border));
	}
	.section-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 0.75rem;
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
		flex-shrink: 0;
		color: var(--color-muted);
		font-size: 0.75rem;
		text-align: center;
	}
	.section-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		flex-shrink: 0;
		border-radius: 0.4rem;
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary-light) 70%, var(--color-surface));
	}
	.section-icon svg {
		width: 1rem;
		height: 1rem;
	}
	.section-label {
		font-size: 0.9rem;
		font-weight: 600;
		flex: 1;
		min-width: 0;
	}
	.count-chip {
		flex-shrink: 0;
		padding: 0.15rem 0.5rem;
		border-radius: 0.4rem;
		font-size: 0.72rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
		background: color-mix(in srgb, var(--color-bg) 80%, var(--color-border));
		border: 1px solid transparent;
	}
	.count-chip.dim {
		opacity: 0.55;
	}
	.count-chip.full {
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary-light) 75%, var(--color-surface));
		border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
	}
	.section-aside {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.55rem;
		padding: 0.45rem 0.75rem 0.45rem 0;
	}
	.vis-switch {
		position: relative;
		display: inline-flex;
		align-items: center;
		cursor: pointer;
		flex-shrink: 0;
	}
	.vis-switch input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
		margin: 0;
	}
	.switch-track {
		display: block;
		width: 2.1rem;
		height: 1.2rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-border) 70%, var(--color-muted));
		border: 1px solid var(--color-border);
		transition: background 0.15s ease, border-color 0.15s ease;
		position: relative;
	}
	.switch-thumb {
		position: absolute;
		top: 50%;
		left: 0.15rem;
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		background: var(--color-surface);
		box-shadow: 0 1px 2px color-mix(in srgb, var(--color-text) 18%, transparent);
		transform: translateY(-50%);
		transition: left 0.15s ease;
	}
	.vis-switch input:checked + .switch-track {
		background: color-mix(in srgb, var(--color-primary) 75%, var(--color-primary-light));
		border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border));
	}
	.vis-switch input:checked + .switch-track .switch-thumb {
		left: calc(100% - 1rem);
	}
	.vis-switch input:focus-visible + .switch-track {
		outline: 2px solid color-mix(in srgb, var(--color-primary) 45%, transparent);
		outline-offset: 2px;
	}
	.manage-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.28rem 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: 0.4rem;
		background: var(--color-bg, var(--color-surface));
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--color-primary);
		text-decoration: none;
		white-space: nowrap;
	}
	.manage-btn svg {
		width: 0.85rem;
		height: 0.85rem;
		flex-shrink: 0;
	}
	.manage-btn:hover {
		border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
		background: color-mix(in srgb, var(--color-primary-light) 55%, var(--color-surface));
	}
	.muted a,
	.writing-hint a {
		color: var(--color-primary);
		font-weight: 600;
		text-decoration: none;
	}
	.muted a:hover,
	.writing-hint a:hover {
		text-decoration: underline;
	}
	.title-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0.55rem 0 0.35rem;
		max-width: 16rem;
	}
	.title-field-label {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--color-muted);
	}
	.title-override {
		width: 100%;
		box-sizing: border-box;
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm, 4px);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: 0.8125rem;
	}
	.section-body {
		grid-column: 1 / -1;
		padding: 0 0.75rem 0.75rem;
		border-top: 1px dashed var(--color-border);
	}
	.section-tools {
		display: flex;
		gap: 0.75rem;
		margin: 0.45rem 0 0.45rem;
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
