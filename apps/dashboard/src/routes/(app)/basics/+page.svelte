<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import { getProfile, updateProfile, type Profile } from '$lib/api/profile';
	import { resolveAvatarUrl } from '$lib/avatar';
	import { showToast } from '$lib/stores/toast';
	import { isSaas } from '$lib/config';

	let shell: EditorWithPreview | undefined = $state();
	let loading = $state(true);
	let saving = $state(false);
	let profile = $state<Profile>({
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
	});

	const emptyBasics = $derived(!profile.name?.trim() || !profile.headline?.trim());
	const showImportCta = $derived(emptyBasics);
	const avatarPreview = $derived(resolveAvatarUrl(profile.avatar_url, profile.email, 128));
	const avatarIsGravatar = $derived(!profile.avatar_url?.trim() && !!avatarPreview);

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
		description="Shared profile information — used across your portfolios and resumes. Update once and it stays consistent everywhere. Social links live under Social."
	/>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else}
		{#if showImportCta}
			<Card>
				<p class="import-cta">
					Skip the blank form —
					<a href="/import">Import resume</a>
					(Pro) to fill basics and your library from a PDF or pasted text.
				</p>
			</Card>
		{/if}
		<Card variant="panel">
			<div class="fields">
				<Input label="Name" bind:value={profile.name} placeholder="Jane Doe" />
				<Input label="Headline" bind:value={profile.headline} placeholder="Full-stack developer" />
				<Textarea label="Bio" bind:value={profile.bio} placeholder="A short introduction…" rows={4} />
				<div class="avatar-row">
					{#if avatarPreview}
						<img
							class="avatar-preview"
							src={avatarPreview}
							alt=""
							width="64"
							height="64"
						/>
					{:else}
						<div class="avatar-preview avatar-preview--empty" aria-hidden="true"></div>
					{/if}
					<div class="avatar-fields">
						<Input
							label="Avatar URL"
							bind:value={profile.avatar_url}
							placeholder="https://… (optional)"
						/>
						<p class="field-hint">
							{#if avatarIsGravatar}
								Using Gravatar for your public email — paste a URL to override.
							{:else if avatarPreview}
								Custom avatar URL. Clear the field to fall back to Gravatar.
							{:else}
								Leave blank to use Gravatar for your public email (identicon if none).
							{/if}
						</p>
					</div>
				</div>
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
		gap: var(--space-3);
	}
	.avatar-row {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.avatar-preview {
		width: 64px;
		height: 64px;
		border-radius: 999px;
		object-fit: cover;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		flex-shrink: 0;
		margin-top: 1.4rem;
	}
	.avatar-preview--empty {
		background: var(--color-border);
		opacity: 0.35;
	}
	.avatar-fields {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.field-hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
		line-height: 1.4;
	}
	.hint {
		margin: var(--space-3) 0 0;
		font-size: 0.8125rem;
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
