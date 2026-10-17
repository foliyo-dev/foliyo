<script lang="ts">
	import { onMount } from 'svelte';
	import { basicSetup } from 'codemirror';
	import { EditorView } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { markdown } from '@codemirror/lang-markdown';

	let {
		value = $bindable(''),
		minHeight = '16rem',
		ariaLabel = 'Markdown editor'
	}: {
		value?: string;
		minHeight?: string;
		ariaLabel?: string;
	} = $props();

	let hostEl = $state<HTMLDivElement | null>(null);
	let view: EditorView | null = null;
	/** True while applying parent → editor sync (avoids feedback loops). */
	let syncingFromParent = false;
	/** True while applying editor → parent updates. */
	let updatingFromEditor = false;

	const theme = EditorView.theme({
		'&': {
			fontSize: '0.875rem',
			fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
			backgroundColor: 'var(--color-surface)',
			color: 'var(--color-text)',
			height: '100%'
		},
		'.cm-scroller': {
			fontFamily: 'inherit',
			lineHeight: '1.5'
		},
		'.cm-content': {
			padding: '0.5rem 0.75rem',
			caretColor: 'var(--color-text)',
			minHeight: 'var(--cm-min-height, 16rem)'
		},
		'.cm-gutters': {
			backgroundColor: 'var(--color-surface)',
			color: 'var(--color-muted)',
			borderRight: '1px solid var(--color-border)'
		},
		'.cm-activeLineGutter': {
			backgroundColor: 'transparent'
		},
		'&.cm-focused': {
			outline: 'none'
		},
		'&.cm-editor.cm-focused': {
			boxShadow: '0 0 0 3px var(--color-primary-light)',
			outline: '2px solid var(--color-primary)',
			outlineOffset: '-1px'
		},
		'.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
			backgroundColor: 'var(--color-primary-light)'
		},
		'.cm-cursor': {
			borderLeftColor: 'var(--color-primary)'
		}
	});

	onMount(() => {
		if (!hostEl) return;

		view = new EditorView({
			parent: hostEl,
			state: EditorState.create({
				doc: value,
				extensions: [
					basicSetup,
					markdown(),
					EditorView.lineWrapping,
					theme,
					EditorView.updateListener.of((update) => {
						if (!update.docChanged || syncingFromParent) return;
						updatingFromEditor = true;
						value = update.state.doc.toString();
						updatingFromEditor = false;
					})
				]
			})
		});

		return () => {
			view?.destroy();
			view = null;
		};
	});

	$effect(() => {
		const next = value;
		if (!view || updatingFromEditor) return;
		if (view.state.doc.toString() === next) return;
		syncingFromParent = true;
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: next }
		});
		syncingFromParent = false;
	});

	export function insertAround(before: string, after = '', placeholder = '') {
		if (!view) {
			value = value + before + placeholder + after;
			return;
		}
		const { from, to } = view.state.selection.main;
		const selected = view.state.sliceDoc(from, to) || placeholder;
		view.dispatch({
			changes: { from, to, insert: before + selected + after },
			selection: { anchor: from + before.length + selected.length },
			scrollIntoView: true
		});
		view.focus();
	}

	export function focus() {
		view?.focus();
	}
</script>

<div
	bind:this={hostEl}
	class="cm-wrap"
	style:--cm-min-height={minHeight}
	role="textbox"
	aria-multiline="true"
	aria-label={ariaLabel}
></div>

<style>
	.cm-wrap {
		width: 100%;
		min-height: var(--cm-min-height, 16rem);
		box-sizing: border-box;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--color-surface);
	}

	.cm-wrap :global(.cm-editor) {
		height: 100%;
		min-height: var(--cm-min-height, 16rem);
	}

	.cm-wrap :global(.cm-scroller) {
		min-height: var(--cm-min-height, 16rem);
	}
</style>
