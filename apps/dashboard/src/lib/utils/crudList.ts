import { get, writable, type Writable } from 'svelte/store';
import { showToast } from '$lib/stores/toast';
import { confirmDelete } from '$lib/stores/confirm';

export type CrudApi<T> = {
	list: () => Promise<T[]>;
	create: (payload: Partial<T>) => Promise<T[]>;
	update: (id: string, payload: Partial<T>) => Promise<unknown>;
	remove: (id: string) => Promise<void>;
};

export type CrudHooks<T> = {
	/** Builds the API payload from the page's current form field values. */
	getPayload: () => Partial<T>;
	/** Populates the page's form field values from an existing item, to start editing it. */
	applyToForm: (item: T) => void;
	/** Resets the page's form field values back to their "add new" defaults. */
	resetFields: () => void;
	/** Human-readable label for an item, used in the delete confirmation dialog. */
	getDeleteLabel: (item: T) => string;
	/** Validates fields before adding; return an error message to block (shown as a toast), or null/undefined to proceed. */
	validate?: () => string | null | undefined;
	/** Guards saving an edit; return false to silently abort (no toast). Defaults to always allowing the save. */
	canSave?: () => boolean;
	/** Called after a successful add/update/delete, e.g. to refresh a live preview. */
	onChange?: () => void | Promise<void>;
	/** Called whenever the form opens (via openAdd or startEdit), e.g. to scroll it into view. */
	onOpen?: () => void;
};

export type CrudLabels = {
	/** Plural noun used in "Failed to load {loadName}", e.g. "experience", "social links". */
	loadName: string;
	/** Singular noun used in "{Entity} added/updated/deleted" and "Failed to add/update/delete {entity}". */
	entity: string;
};

export type CrudList<T extends { id: string }> = {
	items: Writable<T[]>;
	loading: Writable<boolean>;
	saving: Writable<boolean>;
	editingId: Writable<string | null>;
	/** Whether the add/edit form should be shown. Starts closed so the list takes priority. */
	formOpen: Writable<boolean>;
	load: () => Promise<void>;
	resetForm: () => void;
	/** Opens the form in "add new" mode (resetting any previous edit state first). */
	openAdd: () => void;
	add: () => Promise<void>;
	startEdit: (item: T) => void;
	saveEdit: () => Promise<void>;
	remove: (item: T) => Promise<void>;
};

/**
 * Generic list-CRUD controller shared by the dashboard's content-creation pages
 * (experience, education, certifications, languages, social, skills, projects).
 *
 * Encapsulates the load/add/edit/delete lifecycle that's otherwise hand-rolled and
 * duplicated across each page; the page itself still owns its own form field
 * variables and template markup.
 */
export function createCrudList<T extends { id: string }>(
	api: CrudApi<T>,
	hooks: CrudHooks<T>,
	labels: CrudLabels
): CrudList<T> {
	const items = writable<T[]>([]);
	const loading = writable(true);
	const saving = writable(false);
	const editingId = writable<string | null>(null);
	const formOpen = writable(false);

	async function load() {
		loading.set(true);
		try {
			items.set(await api.list());
		} catch {
			items.set([]);
			showToast(`Failed to load ${labels.loadName}`, 'error');
		} finally {
			loading.set(false);
		}
	}

	function resetForm() {
		hooks.resetFields();
		editingId.set(null);
		formOpen.set(false);
	}

	function openAdd() {
		resetForm();
		formOpen.set(true);
		hooks.onOpen?.();
	}

	async function add() {
		const error = hooks.validate?.();
		if (error) {
			showToast(error, 'error');
			return;
		}
		saving.set(true);
		try {
			items.set(await api.create(hooks.getPayload()));
			showToast(`${labels.entity} added`, 'success');
			resetForm();
			await hooks.onChange?.();
		} catch {
			showToast(`Failed to add ${labels.entity.toLowerCase()}`, 'error');
		} finally {
			saving.set(false);
		}
	}

	function startEdit(item: T) {
		editingId.set(item.id);
		hooks.applyToForm(item);
		formOpen.set(true);
		hooks.onOpen?.();
	}

	async function saveEdit() {
		const id = get(editingId);
		if (!id) return;
		if (hooks.canSave && !hooks.canSave()) return;
		saving.set(true);
		try {
			await api.update(id, hooks.getPayload());
			await load();
			showToast(`${labels.entity} updated`, 'success');
			resetForm();
			await hooks.onChange?.();
		} catch {
			showToast(`Failed to update ${labels.entity.toLowerCase()}`, 'error');
		} finally {
			saving.set(false);
		}
	}

	async function remove(item: T) {
		if (!(await confirmDelete(hooks.getDeleteLabel(item)))) return;
		try {
			await api.remove(item.id);
			items.update((list) => list.filter((i) => i.id !== item.id));
			if (get(editingId) === item.id) resetForm();
			showToast(`${labels.entity} moved to Recently deleted`, 'success');
			await hooks.onChange?.();
		} catch {
			showToast(`Failed to delete ${labels.entity.toLowerCase()}`, 'error');
		}
	}

	return { items, loading, saving, editingId, formOpen, load, resetForm, openAdd, add, startEdit, saveEdit, remove };
}
