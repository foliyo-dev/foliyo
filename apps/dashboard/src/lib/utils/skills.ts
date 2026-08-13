/** Serializes a comma-separated "skills" input into the JSON array string the API expects. */
export function skillsToJson(input: string): string {
	const skills = input
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);
	return JSON.stringify(skills);
}

/** Parses a "skills_developed" JSON array string back into a comma-separated input value. */
export function skillsFromJson(json: string): string {
	try {
		const arr = JSON.parse(json || '[]') as string[];
		return Array.isArray(arr) ? arr.join(', ') : '';
	} catch {
		return '';
	}
}
