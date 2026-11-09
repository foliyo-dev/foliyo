/**
 * Portfolio theme CSS for blog live preview (dashboard).
 * Themes style `.prose` the same way public pages do.
 */
import atelierCss from '@foliyo/themes/portfolio/atelier/style.css?raw';
import creativeCss from '@foliyo/themes/portfolio/creative/style.css?raw';
import editorialCss from '@foliyo/themes/portfolio/editorial/style.css?raw';
import minimalCss from '@foliyo/themes/portfolio/minimal/style.css?raw';
import modernCss from '@foliyo/themes/portfolio/modern/style.css?raw';
import noirCss from '@foliyo/themes/portfolio/noir/style.css?raw';

const THEME_CSS: Record<string, string> = {
	minimal: minimalCss,
	modern: modernCss,
	creative: creativeCss,
	noir: noirCss,
	atelier: atelierCss,
	editorial: editorialCss
};

export const PORTFOLIO_THEME_SLUGS = Object.keys(THEME_CSS);

/** Scope `body.theme-X` rules so they work inside a preview container. */
function adaptThemeCss(slug: string, css: string): string {
	const bodyClass = `body.theme-${slug}`;
	const scoped = `.blog-theme-preview.theme-${slug}`;
	return css
		.replace(new RegExp(bodyClass.replace('.', '\\.'), 'g'), scoped)
		.replace(/:root\s*\{/g, `${scoped} {`);
}

export function normalizeThemeSlug(slug: string | null | undefined): string {
	const s = (slug ?? 'minimal').trim().toLowerCase();
	return THEME_CSS[s] ? s : 'minimal';
}

export function getThemePreviewCss(slug: string | null | undefined): string {
	const safe = normalizeThemeSlug(slug);
	return adaptThemeCss(safe, THEME_CSS[safe]!);
}
