import type { InsertListItemInput, ListItem } from '../generated/types.ts';

export const insertListItem = (input: InsertListItemInput): ListItem => {
	const { name } = input;
	return {
		id: new Date().getTime().toString(),
		name,
	};
};
