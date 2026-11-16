<script lang="ts">
	import type { Attachment, Snippet } from 'svelte';

	type Props = {
		children?: Snippet;
	};

	let { children }: Props = $props();

	const portal: Attachment<HTMLDivElement> = (node) => {
		const target = document.getElementById('app-header-actions');
		if (!target) return;
		target.appendChild(node);
		return () => {
			node.remove();
		};
	};
</script>

{#if children}
	<div class="portal-host" {@attach portal}>
		{@render children()}
	</div>
{/if}

<style>
	.portal-host {
		display: contents;
	}
</style>
