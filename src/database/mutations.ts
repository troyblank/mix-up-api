import { type List, type ListItem } from '../generated/types.ts';
import type { DeletedListItem } from '../notify/deletedListItem.ts';
import { requirePool } from './pool.ts';

type DeleteListItemRow = {
	item_id: string;
	item_name: string;
	list_id: string;
	list_name: string;
	list_type: string;
};

export const addList = async (list: List): Promise<void> => {
	const pool = requirePool();

	await pool.query(`insert into public.lists (id, name, type) values ($1, $2, $3)`, [
		list.id,
		list.name,
		list.type,
	]);
};

export const appendListItem = async (listId: string, item: ListItem): Promise<boolean> => {
	const pool = requirePool();
	const { rowCount } = await pool.query(
		`insert into public.list_items (id, list_id, name, sort_order)
     select $1::text, $2::text, $3::text,
            coalesce((select max(sort_order) from public.list_items where list_id = $2::text), 0) + 1
     where exists (select 1 from public.lists where id = $2::text)`,
		[item.id, listId, item.name],
	);
	return (rowCount ?? 0) > 0;
};

export const deleteListItem = async (itemId: string): Promise<DeletedListItem | null> => {
	const pool = requirePool();
	const { rows, rowCount } = await pool.query<DeleteListItemRow>(
		`delete from public.list_items li
     using public.lists l
     where li.id = $1::text and li.list_id = l.id
     returning li.id as item_id, li.name as item_name, li.list_id, l.name as list_name, l.type as list_type`,
		[itemId],
	);
	if ((rowCount ?? 0) === 0 || rows.length === 0) {
		return null;
	}

	const row = rows[0];
	return {
		itemId: row.item_id,
		itemName: row.item_name,
		listId: row.list_id,
		listName: row.list_name,
		listType: row.list_type as DeletedListItem['listType'],
	};
};
