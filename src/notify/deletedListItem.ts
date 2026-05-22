import type { ListType } from '../generated/types.ts';

export type DeletedListItem = {
	itemId: string;
	itemName: string;
	listId: string;
	listName: string;
	listType: ListType;
};
