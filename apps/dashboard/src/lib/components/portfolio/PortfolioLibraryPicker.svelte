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

	function toggle(selected: Set<string>, id: string, checked: boolean): Set<string> {
		const next = new Set(selected);
		if (checked) next.add(id);
		else next.delete(id);
		return next;
	}
</script>

<div class="toggles">
	<label class="checkbox"><input type="checkbox" bind:checked={showSkills} /> Show skills</label>
	<label class="checkbox"><input type="checkbox" bind:checked={showProjects} /> Show projects</label>
	<label class="checkbox"><input type="checkbox" bind:checked={showExperience} /> Show experience</label>
	<label class="checkbox"><input type="checkbox" bind:checked={showEducation} /> Show education</label>
	<label class="checkbox"
		><input type="checkbox" bind:checked={showCertifications} /> Show certifications</label
	>
	<label class="checkbox"><input type="checkbox" bind:checked={showLanguages} /> Show languages</label>
</div>

<div class="picker">
	<h2 class="section-title">Include from your library</h2>
	<p class="hint">{hint}</p>

	{#if skills.length > 0}
		<h3>Skills</h3>
		<ul class="check-list">
			{#each skills as s (s.id)}
				<li>
					<label class="checkbox">
						<input
							type="checkbox"
							checked={selectedSkills.has(s.id)}
							on:change={(e) =>
								(selectedSkills = toggle(selectedSkills, s.id, e.currentTarget.checked))}
						/>
						{s.name} <span class="meta">({s.level})</span>
					</label>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">No skills yet — add some under Skills.</p>
	{/if}

	{#if projects.length > 0}
		<h3>Projects</h3>
		<ul class="check-list">
			{#each projects as p (p.id)}
				<li>
					<label class="checkbox">
						<input
							type="checkbox"
							checked={selectedProjects.has(p.id)}
							on:change={(e) =>
								(selectedProjects = toggle(selectedProjects, p.id, e.currentTarget.checked))}
						/>
						{p.title}
					</label>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">No projects yet — add some under Projects.</p>
	{/if}

	{#if experiences.length > 0}
		<h3>Experience</h3>
		<ul class="check-list">
			{#each experiences as e (e.id)}
				<li>
					<label class="checkbox">
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
						{e.role} at {e.company}
					</label>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">No experience yet — add some under Experience.</p>
	{/if}

	{#if educations.length > 0}
		<h3>Education</h3>
		<ul class="check-list">
			{#each educations as e (e.id)}
				<li>
					<label class="checkbox">
						<input
							type="checkbox"
							checked={selectedEducation.has(e.id)}
							on:change={(ev) =>
								(selectedEducation = toggle(selectedEducation, e.id, ev.currentTarget.checked))}
						/>
						{e.institution}
					</label>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">No education yet — add some under Education.</p>
	{/if}

	{#if certifications.length > 0}
		<h3>Certifications</h3>
		<ul class="check-list">
			{#each certifications as c (c.id)}
				<li>
					<label class="checkbox">
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
						{c.name}{#if c.issuer}<span class="meta"> · {c.issuer}</span>{/if}
					</label>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">No certifications yet — add some under Certifications.</p>
	{/if}

	{#if languages.length > 0}
		<h3>Languages</h3>
		<ul class="check-list">
			{#each languages as l (l.id)}
				<li>
					<label class="checkbox">
						<input
							type="checkbox"
							checked={selectedLanguages.has(l.id)}
							on:change={(ev) =>
								(selectedLanguages = toggle(selectedLanguages, l.id, ev.currentTarget.checked))}
						/>
						{l.name} <span class="meta">({l.proficiency})</span>
					</label>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">No languages yet — add some under Languages.</p>
	{/if}
</div>

<style>
	.toggles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.5rem;
		margin-bottom: 1.25rem;
	}
	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
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
	h3 {
		margin: 1.25rem 0 0.5rem;
		font-size: 0.9375rem;
		color: var(--color-primary);
	}
	.check-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.meta {
		color: var(--color-muted);
		font-size: 0.8125rem;
	}
	.muted {
		color: var(--color-muted);
		font-size: 0.875rem;
	}
</style>
