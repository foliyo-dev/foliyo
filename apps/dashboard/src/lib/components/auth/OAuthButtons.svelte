<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchOAuthProviders, startOAuth } from '$lib/api/cloud';
	import { showToast } from '$lib/stores/toast';
	import Button from '$lib/components/ui/Button.svelte';

	let {
		consent = false,
		disabled = false
	}: {
		consent?: boolean;
		disabled?: boolean;
	} = $props();

	let google = $state(false);
	let github = $state(false);
	let loaded = $state(false);

	onMount(async () => {
		const providers = await fetchOAuthProviders();
		google = providers.google;
		github = providers.github;
		loaded = true;
	});

	function handleOAuth(provider: 'google' | 'github') {
		if (disabled) {
			showToast('Accept the privacy policy first', 'error');
			return;
		}
		startOAuth(provider, consent ? { consent: true } : undefined);
	}
</script>

{#if loaded && (google || github)}
	<div class="oauth">
		<p class="divider"><span>or</span></p>
		{#if google}
			<Button variant="secondary" {disabled} on:click={() => handleOAuth('google')}>
				Continue with Google
			</Button>
		{/if}
		{#if github}
			<Button variant="secondary" {disabled} on:click={() => handleOAuth('github')}>
				Continue with GitHub
			</Button>
		{/if}
	</div>
{/if}

<style>
	.oauth {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.oauth :global(button) {
		width: 100%;
	}
	.divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
		text-align: center;
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}
	.divider span {
		flex-shrink: 0;
	}
</style>
