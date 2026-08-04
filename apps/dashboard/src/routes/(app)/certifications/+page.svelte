<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import {
		listCertifications,
		createCertification,
		updateCertification,
		deleteCertification,
		type Certification
	} from '$lib/api/certifications';
	import { showToast } from '$lib/stores/toast';

	let shell: EditorWithPreview;
	let items: Certification[] = [];
	let loading = true;
	let saving = false;
	let editingId: string | null = null;

	let name = '';
	let issuer = '';
	let credentialId = '';
	let credentialUrl = '';
	let issuedAt = '';
	let expiresAt = '';
	let noExpiry = true;
	let description = '';
	let sortOrder = '0';

	onMount(load);

	async function load() {
		loading = true;
		try {
			items = await listCertifications();
		} catch {
			items = [];
			showToast('Failed to load certifications', 'error');
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		name = '';
		issuer = '';
		credentialId = '';
		credentialUrl = '';
		issuedAt = '';
		expiresAt = '';
		noExpiry = true;
		description = '';
		sortOrder = String(items.length);
		editingId = null;
	}

	function payload(): Partial<Certification> {
		return {
			name: name.trim(),
			issuer,
			credential_id: credentialId,
			credential_url: credentialUrl,
			issued_at: issuedAt || null,
			expires_at: noExpiry ? null : expiresAt || null,
			description,
			sort_order: Number(sortOrder) || 0
		};
	}

	async function add() {
		if (!name.trim()) {
			showToast('Name is required', 'error');
			return;
		}
		saving = true;
		try {
			items = await createCertification(payload());
			showToast('Certification added', 'success');
			resetForm();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to add certification', 'error');
		} finally {
			saving = false;
		}
	}

	function startEdit(item: Certification) {
		editingId = item.id;
		name = item.name;
		issuer = item.issuer;
		credentialId = item.credential_id;
		credentialUrl = item.credential_url;
		issuedAt = item.issued_at ?? '';
		expiresAt = item.expires_at ?? '';
		noExpiry = !item.expires_at;
		description = item.description;
		sortOrder = String(item.sort_order);
		shell?.scrollToForm();
	}

	async function saveEdit() {
		if (!editingId) return;
		saving = true;
		try {
			await updateCertification(editingId, payload());
			await load();
			showToast('Certification updated', 'success');
			resetForm();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to update certification', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		try {
			await deleteCertification(id);
			items = items.filter((c) => c.id !== id);
			if (editingId === id) resetForm();
			showToast('Certification deleted', 'success');
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to delete certification', 'error');
		}
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={editingId ? 'Edit certification' : 'Certifications'}
		description="Credentials and licenses — select which ones appear on your public profile and resume."
	/>

	<Card>
	<h2 class="section-title">{editingId ? 'Edit certification' : 'Add certification'}</h2>
	<div class="fields">
		<Input label="Name" bind:value={name} placeholder="AWS Solutions Architect Associate" />
		<Input label="Issuer" bind:value={issuer} placeholder="Amazon Web Services" />
		<div class="row">
			<Input label="Credential ID" bind:value={credentialId} placeholder="ABC-123" />
			<Input label="Credential URL" bind:value={credentialUrl} placeholder="https://…" />
		</div>
		<div class="row">
			<Input label="Issued" bind:value={issuedAt} placeholder="2024-06" />
			<Input label="Expires" bind:value={expiresAt} placeholder="2027-06" disabled={noExpiry} />
		</div>
		<label class="checkbox">
			<input type="checkbox" bind:checked={noExpiry} />
			Does not expire
		</label>
		<Textarea label="Description" bind:value={description} rows={3} />
		<Input label="Sort order" bind:value={sortOrder} />
	</div>
	<div class="form-actions">
		{#if editingId}
			<Button disabled={saving} on:click={saveEdit}>{saving ? 'Saving…' : 'Save changes'}</Button>
			<Button variant="ghost" on:click={resetForm}>Cancel</Button>
		{:else}
			<Button disabled={saving} on:click={add}>{saving ? 'Adding…' : 'Add certification'}</Button>
		{/if}
	</div>
</Card>

{#if loading}
	<p class="muted">Loading…</p>
{:else if items.length === 0}
	<p class="muted empty">No certifications yet.</p>
{:else}
	<ul class="list">
		{#each items as item (item.id)}
			<li>
				<Card>
					<div class="item-row">
						<div>
							<strong>{item.name}</strong>
							{#if item.issuer}
								<span class="meta">{item.issuer}</span>
							{/if}
							<span class="meta">
								{#if item.issued_at}Issued {item.issued_at}{/if}
								{#if item.expires_at}
									{#if item.issued_at} · {/if}Expires {item.expires_at}
								{:else if item.issued_at}
									 · No expiry
								{/if}
							</span>
							{#if item.description}
								<p class="desc">{item.description}</p>
							{/if}
						</div>
						<div class="row-actions">
							<Button variant="ghost" on:click={() => startEdit(item)}>Edit</Button>
							<Button variant="ghost" on:click={() => remove(item.id)}>Delete</Button>
						</div>
					</div>
				</Card>
			</li>
		{/each}
	</ul>
{/if}
</EditorWithPreview>

<style>
	.section-title {
		margin: 0 0 1rem;
		font-size: 1rem;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 1rem;
	}
	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}
	.form-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.muted {
		color: var(--color-muted);
	}
	.empty {
		margin-top: 1rem;
	}
	.list {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.item-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.meta {
		display: block;
		font-size: 0.8125rem;
		color: var(--color-muted);
		margin-top: 0.25rem;
	}
	.desc {
		margin: 0.35rem 0 0;
		font-size: 0.875rem;
	}
	.row-actions {
		display: flex;
		gap: 0.25rem;
	}
</style>
