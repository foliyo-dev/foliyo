<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import { getProfile, updateProfile, type Profile } from '$lib/api/profile';
	import { showToast } from '$lib/stores/toast';
	import { isSaas } from '$lib/config';

	let shell: EditorWithPreview;
	let loading = true;
	let saving = false;
	let profile: Profile = {
		id: '',
		name: '',
		headline: '',
		bio: '',
		avatar_url: '',
		location: '',
		email: '',
		website: '',
		github: '',
		linkedin: '',
		twitter: ''
	};

	$: emptyBasics = !profile.name?.trim() || !profile.headline?.trim();
	$: showImportCta = isSaas && emptyBasics;

	onMount(async () => {
		try {
			profile = await getProfile();
		} catch {
			showToast('Failed to load basics', 'error');
		} finally {
			loading = false;
		}
	});

	async function save() {
		saving = true;
		try {
			profile = await updateProfile({
				name: profile.name,
				headline: profile.headline,
				bio: profile.bio,
				avatar_url: profile.avatar_url,
				location: profile.location,
				email: profile.email
			});
			showToast('Basics saved', 'success');
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to save basics', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title="Basics"
		description="Name, bio, and contact — shared across portfolios and resumes. Social links live under Social."
	/>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else}
		{#if showImportCta}
			<Card>
				<p class="import-cta">
					Skip the blank form —
					<a href="/import">import a resume with AI</a>
					(Pro) to fill basics and your library from a PDF or pasted text.
				</p>
			</Card>
		{/if}
		<Card>
			<div class="fields">
				<Input label="Name" bind:value={profile.name} placeholder="Jane Doe" />
				<Input label="Headline" bind:value={profile.headline} placeholder="Full-stack developer" />
				<Textarea label="Bio" bind:value={profile.bio} placeholder="A short introduction…" rows={5} />
				<Input label="Avatar URL" bind:value={profile.avatar_url} placeholder="https://…" />
				<Input label="Location" bind:value={profile.location} placeholder="Mumbai, India" />
				<Input
					label="Public email"
					type="email"
					bind:value={profile.email}
					placeholder="hello@example.com"
				/>
			</div>
			<p class="hint">
				Add GitHub, LinkedIn, website, and more in <a href="/social">Social</a>.
			</p>
			<div class="actions">
				<Button disabled={saving} on:click={save}>{saving ? 'Saving…' : 'Save basics'}</Button>
			</div>
		</Card>
	{/if}
</EditorWithPreview>

<style>
	.muted {
		color: var(--color-muted);
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.hint {
		margin: 1rem 0 0;
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	.import-cta {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--color-muted);
	}
	.import-cta a {
		font-weight: 600;
	}
	.actions {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}
</style>
