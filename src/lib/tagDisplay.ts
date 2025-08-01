import { getTagEquivalencies } from './database';

export async function getTagDisplayName(tag: Tag): Promise<string> {
	if (!tag.id) return tag.name;

	// Check if this tag is linked as an equivalency to another tag
	const equivalencies = await getTagEquivalencies(tag.id);

	if (equivalencies.length === 0) {
		return tag.name;
	}

	// For now, just use the first equivalency found
	const equivalency = equivalencies[0];
	const details = equivalency.junctionType?.details;

	if (details?.useOriginalName) {
		return tag.name;
	}

	return details?.displayName || tag.name;
}

export async function getAllTagEquivalencies(): Promise<Map<string, Junction[]>> {
	// This would need to be implemented to get all equivalencies at once
	// For now, return empty map - this optimization can be added later
	return new Map();
}

export function getDisplayNameFromEquivalency(tag: Tag, equivalency?: Junction): string {
	if (!equivalency?.junctionType?.details) {
		return tag.name;
	}

	const details = equivalency.junctionType.details;

	if (details.useOriginalName) {
		return tag.name;
	}

	return details.displayName || tag.name;
}
