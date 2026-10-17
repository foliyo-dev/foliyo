/**
 * Minimal Markdown → safe HTML for blog preview (dashboard client copy).
 * Keep in sync with `apps/core/src/markdown.ts`.
 * Escape-first, then apply a small allowlist of block/inline patterns.
 * No raw HTML from authors is passed through.
 */

const UPLOAD_IMG = /^\/uploads\/[a-f0-9]{32}\.(jpe?g|png|webp)$/i;

function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function safeImgSrc(raw: string): string | null {
	const src = raw.trim();
	if (/^https?:\/\//i.test(src)) {
		try {
			const u = new URL(src);
			if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
		} catch {
			return null;
		}
		return null;
	}
	if (UPLOAD_IMG.test(src)) return src;
	return null;
}

function inline(text: string): string {
	const imgs: string[] = [];
	let s = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
		const safe = safeImgSrc(src);
		if (!safe) return `![${alt}](${src})`;
		const token = `%%FOLIYOIMG${imgs.length}%%`;
		imgs.push(`<img src="${esc(safe)}" alt="${esc(alt)}" loading="lazy" />`);
		return token;
	});

	s = esc(s);
	for (let i = 0; i < imgs.length; i++) {
		s = s.replace(`%%FOLIYOIMG${i}%%`, imgs[i]!);
	}

	// code
	s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
	// bold
	s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
	// italic
	s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
	s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
	// links [label](https://...) — href/label already escaped above
	s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label: string, href: string) => {
		return `<a href="${href}" rel="noopener noreferrer">${label}</a>`;
	});
	return s;
}

function isBlockStart(line: string): boolean {
	return (
		/^#{1,3}\s/.test(line) ||
		/^[-*]\s+/.test(line) ||
		/^\d+\.\s+/.test(line) ||
		/^```/.test(line) ||
		/^---+$/.test(line.trim()) ||
		/^\*\*\*+$/.test(line.trim()) ||
		/^>\s?/.test(line)
	);
}

/**
 * Convert Markdown subset to sanitized HTML.
 * Supports: headings (#–###), paragraphs, ul/ol, fenced code, hr, blockquotes,
 * inline bold/italic/code/https links, images `![alt](https://...)` and `![alt](/uploads/...)`.
 */
export function markdownToSafeHtml(source: string): string {
	const raw = (source ?? '').replace(/\r\n/g, '\n').trim();
	if (!raw) return '';

	const lines = raw.split('\n');
	const out: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i] ?? '';

		if (/^```/.test(line)) {
			const code: string[] = [];
			i += 1;
			while (i < lines.length && !/^```/.test(lines[i] ?? '')) {
				code.push(lines[i] ?? '');
				i += 1;
			}
			i += 1; // closing fence
			out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
			continue;
		}

		if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
			out.push('<hr />');
			i += 1;
			continue;
		}

		const heading = /^(#{1,3})\s+(.+)$/.exec(line);
		if (heading) {
			const level = heading[1]!.length;
			out.push(`<h${level}>${inline(heading[2]!.trim())}</h${level}>`);
			i += 1;
			continue;
		}

		if (/^>\s?/.test(line)) {
			const parts: string[] = [];
			while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
				parts.push(inline((lines[i] ?? '').replace(/^>\s?/, '')));
				i += 1;
			}
			out.push(`<blockquote><p>${parts.join('<br />')}</p></blockquote>`);
			continue;
		}

		if (/^[-*]\s+/.test(line)) {
			const items: string[] = [];
			while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? '')) {
				items.push(`<li>${inline((lines[i] ?? '').replace(/^[-*]\s+/, ''))}</li>`);
				i += 1;
			}
			out.push(`<ul>${items.join('')}</ul>`);
			continue;
		}

		if (/^\d+\.\s+/.test(line)) {
			const items: string[] = [];
			while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? '')) {
				items.push(`<li>${inline((lines[i] ?? '').replace(/^\d+\.\s+/, ''))}</li>`);
				i += 1;
			}
			out.push(`<ol>${items.join('')}</ol>`);
			continue;
		}

		if (!line.trim()) {
			i += 1;
			continue;
		}

		const para: string[] = [line];
		i += 1;
		while (i < lines.length && (lines[i] ?? '').trim() && !isBlockStart(lines[i] ?? '')) {
			para.push(lines[i] ?? '');
			i += 1;
		}
		out.push(`<p>${inline(para.join(' '))}</p>`);
	}

	return out.join('\n');
}
