<script lang="ts">
	import logoDefault from '@foliyo/brand/assets/foliyo-logo.svg?url';
	import logoDark from '@foliyo/brand/assets/foliyo-logo-dark.svg?url';
	import logoTagline from '@foliyo/brand/assets/foliyo-logo-tagline.svg?url';

	export let variant: 'default' | 'dark' | 'tagline' = 'default';
	export let alt = 'Foliyo';
	/** When only one dimension is set, the other is derived from the SVG aspect ratio. */
	export let width: number | string | undefined = undefined;
	export let height: number | string | undefined = undefined;

	const intrinsic = {
		default: { w: 168, h: 44 },
		dark: { w: 168, h: 44 },
		tagline: { w: 220, h: 52 }
	} as const;

	$: dims = intrinsic[variant === 'tagline' ? 'tagline' : variant === 'dark' ? 'dark' : 'default'];
	$: src =
		variant === 'dark' ? logoDark : variant === 'tagline' ? logoTagline : logoDefault;

	function num(v: number | string | undefined): number | undefined {
		if (v == null || v === '') return undefined;
		const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
		return Number.isFinite(n) ? n : undefined;
	}

	$: h = num(height);
	$: w = num(width);
	// Prefer height when both are set so the SVG never stretches.
	$: resolvedHeight = h ?? (w != null ? (w * dims.h) / dims.w : 28);
	$: resolvedWidth = (resolvedHeight * dims.w) / dims.h;
</script>

<img
	{src}
	{alt}
	width={Math.round(resolvedWidth * 100) / 100}
	height={Math.round(resolvedHeight * 100) / 100}
	class="foliyo-logo {$$props.class ?? ''}"
/>

<style>
	.foliyo-logo {
		display: block;
		flex-shrink: 0;
	}
</style>
