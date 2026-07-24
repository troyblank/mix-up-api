import type { DeletedListItem } from './deletedListItem.ts';
import type { ListType } from './generated/types.ts';

export type DeletedList = {
	listId: string;
	listName: string;
	listType: ListType;
	items: DeletedListItem[];
};
