<script lang="ts">
	import logoDefault from '@foliyo/brand/assets/foliyo-logo.svg?url';
	import logoDark from '@foliyo/brand/assets/foliyo-logo-dark.svg?url';
	import logoTagline from '@foliyo/brand/assets/foliyo-logo-tagline.svg?url';

	export let variant: 'default' | 'dark' | 'tagline' = 'default';
	export let alt = 'Foliyo';
	export let width: number | string = 120;
	export let height: number | string = 30;

	const src =
		variant === 'dark' ? logoDark : variant === 'tagline' ? logoTagline : logoDefault;
</script>

<img {src} {alt} {width} {height} class={$$props.class ?? ''} {...$$restProps} />
