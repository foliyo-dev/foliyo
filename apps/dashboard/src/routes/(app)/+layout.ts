import { redirect } from '@sveltejs/kit';
import { isSaas } from '$lib/config';
import { loadSession, needsOnboarding, user } from '$lib/stores/auth';
import { get } from 'svelte/store';
import type { LayoutLoad } from './$types';

export const ssr = false;

export const load: LayoutLoad = async () => {
  const ok = await loadSession();
  if (!ok) throw redirect(303, isSaas ? '/signup' : '/login');
  if (isSaas && needsOnboarding(get(user))) throw redirect(303, '/onboarding');
  return {};
};
