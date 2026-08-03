<script lang="ts">
	import { socialIconPath } from '$lib/social/icons';

	export let provider = 'other';
	export let size = 18;
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="currentColor"
	aria-hidden="true"
	class="icon"
>
	<path d={socialIconPath(provider)} />
</svg>

<style>
	.icon {
		display: block;
		flex-shrink: 0;
	}
</style>
