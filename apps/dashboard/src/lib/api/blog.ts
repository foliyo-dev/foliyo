import { api } from './client';

export type BlogPost = {
	id: string;
	title: string;
	slug: string;
	content: string;
	excerpt: string;
	cover_image: string;
	tags: string;
	status: 'draft' | 'published';
	published_at: string | null;
	created_at?: string;
	updated_at?: string;
};

export function slugify(title: string): string {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.slice(0, 80);
}

export function tagsToJson(input: string): string {
	const tags = input
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);
	return JSON.stringify(tags);
}

export function tagsFromJson(json: string): string {
	try {
		const arr = JSON.parse(json);
		return Array.isArray(arr) ? arr.join(', ') : '';
	} catch {
		return '';
	}
}

export const listPosts = () => api<BlogPost[]>('/blog/posts');
export const createPost = (data: Partial<BlogPost>) =>
	api<BlogPost[]>('/blog/posts', { method: 'POST', body: JSON.stringify(data) });
export const updatePost = (id: string, data: Partial<BlogPost>) =>
	api<{ ok: boolean }>(`/blog/posts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePost = (id: string) =>
	api<void>(`/blog/posts/${id}`, { method: 'DELETE' });
