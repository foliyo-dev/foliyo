/** Parses a "skills_developed" JSON array string into a string[]. */
export function parseSkillsJson(json: string): string[] {
	try {
		const arr = JSON.parse(json || '[]') as unknown;
		if (!Array.isArray(arr)) return [];
		return arr
			.filter((t): t is string => typeof t === 'string')
			.map((t) => t.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

/** Serializes a skills array into the JSON array string the API expects. */
export function skillsArrayToJson(skills: string[]): string {
	return JSON.stringify(skills.map((t) => t.trim()).filter(Boolean));
}

/** Serializes a comma-separated "skills" input into the JSON array string the API expects. */
export function skillsToJson(input: string): string {
	return skillsArrayToJson(input.split(','));
}

/** Parses a "skills_developed" JSON array string back into a comma-separated input value. */
export function skillsFromJson(json: string): string {
	return parseSkillsJson(json).join(', ');
}
