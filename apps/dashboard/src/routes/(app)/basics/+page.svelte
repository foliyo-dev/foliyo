<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { getProfile, updateProfile, type Profile } from '$lib/api/profile';
	import { showToast } from '$lib/stores/toast';

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
				email: profile.email,
				website: profile.website,
				github: profile.github,
				linkedin: profile.linkedin,
				twitter: profile.twitter
			});
			showToast('Basics saved', 'success');
		} catch {
			showToast('Failed to save basics', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<PageHeader
	title="Basics"
	description="Name, default bio, and links — shared across portfolios and resumes. Headline/bio can be overridden per portfolio."
/>

{#if loading}
	<p class="muted">Loading…</p>
{:else}
	<Card>
		<div class="fields">
			<Input label="Name" bind:value={profile.name} placeholder="Jane Doe" />
			<Input label="Headline" bind:value={profile.headline} placeholder="Full-stack developer" />
			<Textarea label="Bio" bind:value={profile.bio} placeholder="A short introduction…" rows={5} />
			<Input label="Avatar URL" bind:value={profile.avatar_url} placeholder="https://…" />
			<Input label="Location" bind:value={profile.location} placeholder="Mumbai, India" />
			<Input label="Public email" type="email" bind:value={profile.email} placeholder="hello@example.com" />
			<Input label="Website" bind:value={profile.website} placeholder="https://yoursite.com" />
			<div class="row">
				<Input label="GitHub" bind:value={profile.github} placeholder="username" />
				<Input label="LinkedIn" bind:value={profile.linkedin} placeholder="username" />
				<Input label="Twitter / X" bind:value={profile.twitter} placeholder="username" />
			</div>
		</div>
		<div class="actions">
			<Button disabled={saving} on:click={save}>{saving ? 'Saving…' : 'Save basics'}</Button>
		</div>
	</Card>
{/if}

<style>
	.muted {
		color: var(--color-muted);
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 1rem;
	}
	.actions {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}
</style>
