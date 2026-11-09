<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Image from '@tiptap/extension-image';
	import { Markdown } from '@tiptap/markdown';

	let {
		value = $bindable(''),
		minHeight = '16rem',
		ariaLabel = 'Post content',
		uploading = false,
		onUploadImage
	}: {
		value?: string;
		minHeight?: string;
		ariaLabel?: string;
		uploading?: boolean;
		onUploadImage?: (file: File) => Promise<string | null>;
	} = $props();

	let hostEl = $state<HTMLDivElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let editor: Editor | null = null;
	let sourceMode = $state(false);
	let sourceText = $state('');
	let uiTick = $state(0);
	let syncingFromParent = false;
	let updatingFromEditor = false;

	function bumpUi() {
		uiTick += 1;
	}

	function isActive(name: string, attrs?: Record<string, unknown>): boolean {
		void uiTick;
		return editor?.isActive(name, attrs) ?? false;
	}

	function readMarkdown(): string {
		if (!editor) return value;
		return editor.getMarkdown();
	}

	function applyMarkdown(md: string) {
		if (!editor) return;
		syncingFromParent = true;
		editor.commands.setContent(md, { contentType: 'markdown' });
		syncingFromParent = false;
	}

	onMount(() => {
		if (!hostEl) return;

		editor = new Editor({
			element: hostEl,
			extensions: [
				StarterKit.configure({
					heading: { levels: [1, 2, 3] },
					link: {
						openOnClick: false,
						autolink: true,
						HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
					}
				}),
				Image.configure({
					allowBase64: false,
					HTMLAttributes: { loading: 'lazy' }
				}),
				Markdown
			],
			content: value || '',
			contentType: 'markdown',
			editorProps: {
				attributes: {
					class: 'tiptap-body',
					role: 'textbox',
					'aria-multiline': 'true',
					'aria-label': ariaLabel
				}
			},
			onUpdate: ({ editor: ed }) => {
				if (syncingFromParent || sourceMode) return;
				updatingFromEditor = true;
				value = ed.getMarkdown();
				updatingFromEditor = false;
				bumpUi();
			},
			onSelectionUpdate: bumpUi,
			onTransaction: bumpUi
		});

		return () => {
			editor?.destroy();
			editor = null;
		};
	});

	$effect(() => {
		const next = value;
		if (!editor || updatingFromEditor || sourceMode) return;
		if (readMarkdown() === next) return;
		applyMarkdown(next);
	});

	function run(cmd: () => void) {
		if (!editor || sourceMode) return;
		cmd();
		editor.chain().focus().run();
		bumpUi();
	}

	function toggleHeading(level: 2 | 3) {
		run(() => {
			editor!.chain().focus().toggleHeading({ level }).run();
		});
	}

	function toggleBold() {
		run(() => editor!.chain().focus().toggleBold().run());
	}

	function toggleItalic() {
		run(() => editor!.chain().focus().toggleItalic().run());
	}

	function toggleBullet() {
		run(() => editor!.chain().focus().toggleBulletList().run());
	}

	function toggleOrdered() {
		run(() => editor!.chain().focus().toggleOrderedList().run());
	}

	function toggleCodeBlock() {
		run(() => editor!.chain().focus().toggleCodeBlock().run());
	}

	function toggleQuote() {
		run(() => editor!.chain().focus().toggleBlockquote().run());
	}

	function setLink() {
		if (!editor || sourceMode) return;
		const prev = editor.getAttributes('link').href as string | undefined;
		const href = window.prompt('Link URL (https://…)', prev || 'https://');
		if (href === null) return;
		const trimmed = href.trim();
		if (!trimmed) {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
		} else {
			editor
				.chain()
				.focus()
				.extendMarkRange('link')
				.setLink({ href: trimmed, target: '_blank', rel: 'noopener noreferrer' })
				.run();
		}
		bumpUi();
	}

	export function insertImage(url: string, alt = '') {
		if (!editor) {
			value = `${value}\n\n![${alt}](${url})\n`;
			return;
		}
		if (sourceMode) {
			sourceText = `${sourceText}\n\n![${alt}](${url})\n`;
			value = sourceText;
			return;
		}
		editor.chain().focus().setImage({ src: url, alt }).run();
		value = editor.getMarkdown();
		bumpUi();
	}

	async function onImageFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !onUploadImage) return;
		const url = await onUploadImage(file);
		if (url) insertImage(url, file.name.replace(/\.[^.]+$/, ''));
	}

	function enterSourceMode() {
		sourceText = editor ? editor.getMarkdown() : value;
		sourceMode = true;
	}

	function leaveSourceMode() {
		value = sourceText;
		sourceMode = false;
		queueMicrotask(() => applyMarkdown(sourceText));
	}

	function toggleSource() {
		if (sourceMode) leaveSourceMode();
		else enterSourceMode();
	}

	function onSourceInput() {
		value = sourceText;
	}

	export function focus() {
		if (sourceMode) return;
		editor?.chain().focus().run();
	}
</script>

<div class="editor-shell" style:--editor-min-height={minHeight}>
	<div class="toolbar" role="toolbar" aria-label="Formatting">
		<button
			type="button"
			class="tool"
			class:active={isActive('heading', { level: 2 })}
			disabled={sourceMode}
			onclick={() => toggleHeading(2)}
			title="Heading 2">H2</button
		>
		<button
			type="button"
			class="tool"
			class:active={isActive('heading', { level: 3 })}
			disabled={sourceMode}
			onclick={() => toggleHeading(3)}
			title="Heading 3">H3</button
		>
		<button
			type="button"
			class="tool"
			class:active={isActive('bold')}
			disabled={sourceMode}
			onclick={toggleBold}
			title="Bold"><strong>B</strong></button
		>
		<button
			type="button"
			class="tool"
			class:active={isActive('italic')}
			disabled={sourceMode}
			onclick={toggleItalic}
			title="Italic"><em>I</em></button
		>
		<button
			type="button"
			class="tool"
			class:active={isActive('link')}
			disabled={sourceMode}
			onclick={setLink}
			title="Link">Link</button
		>
		<button
			type="button"
			class="tool"
			class:active={isActive('bulletList')}
			disabled={sourceMode}
			onclick={toggleBullet}
			title="Bullet list">List</button
		>
		<button
			type="button"
			class="tool"
			class:active={isActive('orderedList')}
			disabled={sourceMode}
			onclick={toggleOrdered}
			title="Numbered list">1.</button
		>
		<button
			type="button"
			class="tool"
			class:active={isActive('codeBlock')}
			disabled={sourceMode}
			onclick={toggleCodeBlock}
			title="Code block">Code</button
		>
		<button
			type="button"
			class="tool"
			class:active={isActive('blockquote')}
			disabled={sourceMode}
			onclick={toggleQuote}
			title="Quote">Quote</button
		>
		<button
			type="button"
			class="tool"
			disabled={sourceMode || uploading || !onUploadImage}
			onclick={() => fileInput?.click()}
			title="Insert image">{uploading ? '…' : 'Image'}</button
		>
		<button
			type="button"
			class="tool source-toggle"
			class:active={sourceMode}
			onclick={toggleSource}
			title="Toggle Markdown source">{sourceMode ? 'Visual' : 'Markdown'}</button
		>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/jpeg,image/png,image/webp"
			class="sr-only"
			onchange={onImageFile}
		/>
	</div>

	{#if sourceMode}
		<textarea
			class="source"
			bind:value={sourceText}
			oninput={onSourceInput}
			aria-label="{ariaLabel} (Markdown source)"
			spellcheck="true"
		></textarea>
	{/if}
	<!-- Keep TipTap host mounted so the Editor instance survives source mode. -->
	<div class="host-wrap" class:host-hidden={sourceMode} bind:this={hostEl}></div>
</div>

<style>
	.editor-shell {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		min-width: 0;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.tool {
		padding: 0.3rem 0.55rem;
		font-size: 0.75rem;
		font-weight: 600;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}
	.tool:hover:not(:disabled) {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}
	.tool:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.tool.active {
		border-color: var(--color-primary);
		background: var(--color-primary-light);
		color: var(--color-primary);
	}
	.source-toggle {
		margin-left: auto;
	}
	.host-wrap {
		width: 100%;
		min-height: var(--editor-min-height, 16rem);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		overflow: hidden;
	}
	.host-wrap.host-hidden {
		display: none;
	}
	.host-wrap :global(.tiptap-body) {
		min-height: var(--editor-min-height, 16rem);
		padding: 0.85rem 1rem;
		outline: none;
		font-size: 0.9375rem;
		line-height: 1.65;
		color: var(--color-text);
	}
	.host-wrap :global(.tiptap-body:focus) {
		box-shadow: 0 0 0 3px var(--color-primary-light);
		outline: 2px solid var(--color-primary);
		outline-offset: -1px;
	}
	.host-wrap :global(.tiptap-body p) {
		margin: 0.55em 0;
	}
	.host-wrap :global(.tiptap-body h1),
	.host-wrap :global(.tiptap-body h2),
	.host-wrap :global(.tiptap-body h3) {
		margin: 1em 0 0.4em;
		line-height: 1.25;
		letter-spacing: -0.02em;
	}
	.host-wrap :global(.tiptap-body h2) {
		font-size: 1.25rem;
	}
	.host-wrap :global(.tiptap-body h3) {
		font-size: 1.1rem;
	}
	.host-wrap :global(.tiptap-body ul),
	.host-wrap :global(.tiptap-body ol) {
		margin: 0.55em 0;
		padding-left: 1.35rem;
	}
	.host-wrap :global(.tiptap-body blockquote) {
		margin: 0.65em 0;
		padding-left: 0.85rem;
		border-left: 3px solid var(--color-border);
		color: var(--color-muted);
	}
	.host-wrap :global(.tiptap-body pre) {
		padding: 0.75rem;
		overflow-x: auto;
		border-radius: var(--radius);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		font-size: 0.8125rem;
	}
	.host-wrap :global(.tiptap-body code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.875em;
	}
	.host-wrap :global(.tiptap-body img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius);
	}
	.host-wrap :global(.tiptap-body a) {
		color: var(--color-primary);
	}
	.host-wrap :global(.tiptap-body p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
		color: var(--color-muted);
	}
	.source {
		width: 100%;
		min-height: var(--editor-min-height, 16rem);
		box-sizing: border-box;
		padding: 0.75rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.8125rem;
		line-height: 1.5;
		resize: vertical;
	}
	.source:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: -1px;
		box-shadow: 0 0 0 3px var(--color-primary-light);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
