import { api } from './client';

export type IndianState = { name: string; code: string };

export type BillingProfile = {
	legal_name: string;
	address_line1: string;
	address_line2: string;
	city: string;
	pincode: string;
	state: string;
	state_code: string;
	gstin: string | null;
	complete: boolean;
	updated_at: string | null;
};

export type BillingPayload = {
	legal_name: string;
	address_line1: string;
	address_line2?: string;
	city: string;
	pincode: string;
	state: string;
	gstin?: string | null;
};

export const getBilling = () =>
	api<{ profile: BillingProfile; states: IndianState[] }>('/account/billing');

export const saveBilling = (body: BillingPayload) =>
	api<{ ok: boolean; profile: BillingProfile }>('/account/billing', {
		method: 'PUT',
		body: JSON.stringify(body)
	});
