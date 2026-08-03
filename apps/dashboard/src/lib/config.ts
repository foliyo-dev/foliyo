/** True when built for foliyo.dev SaaS (VITE_SAAS=true). Self-host builds omit this — no paywall UI needed once /api/plan reports selfhost. */
export const isSaas = import.meta.env.VITE_SAAS === 'true';

export const siteUrl = import.meta.env.VITE_SITE_URL ?? 'https://foliyo.dev';
