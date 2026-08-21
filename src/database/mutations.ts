import { type List, type ListItem } from '../generated/types.ts';
import type { DeletedList } from '../deletedList.ts';
import type { DeletedListItem } from '../deletedListItem.ts';
import { listVisibilityClause } from './listAccess.ts';
import { requirePool } from './pool.ts';

type DeleteListItemRow = {
	item_id: string;
	item_name: string;
	list_id: string;
	list_name: string;
	list_type: string;
};

export const addList = async (list: List, ownerUserId: string | null): Promise<void> => {
	const pool = requirePool();

	await pool.query(
		`insert into public.lists (id, name, type, is_private, owner_user_id) values ($1, $2, $3, $4, $5)`,
		[list.id, list.name, list.type, list.isPrivate, ownerUserId],
	);
};

export const appendListItem = async (
	listId: string,
	item: ListItem,
	userId: string,
): Promise<boolean> => {
	const pool = requirePool();
	const { rowCount } = await pool.query(
		`insert into public.list_items (id, list_id, name, sort_order)
     select $1::text, $2::text, $3::text,
            coalesce((select max(sort_order) from public.list_items where list_id = $2::text), 0) + 1
     where exists (
       select 1 from public.lists l
       where l.id = $2::text and ${listVisibilityClause(4)}
     )`,
		[item.id, listId, item.name, userId],
	);
	return (rowCount ?? 0) > 0;
};

const mapDeleteListItemRow = (row: DeleteListItemRow): DeletedListItem => ({
	itemId: row.item_id,
	itemName: row.item_name,
	listId: row.list_id,
	listName: row.list_name,
	listType: row.list_type as DeletedListItem['listType'],
});

export const deleteListItem = async (
	itemId: string,
	userId: string,
): Promise<DeletedListItem | null> => {
	const pool = requirePool();
	const { rows, rowCount } = await pool.query<DeleteListItemRow>(
		`delete from public.list_items li
     using public.lists l
     where li.id = $1::text and li.list_id = l.id
       and ${listVisibilityClause(2)}
     returning li.id as item_id, li.name as item_name, li.list_id, l.name as list_name, l.type as list_type`,
		[itemId, userId],
	);
	if ((rowCount ?? 0) === 0 || rows.length === 0) {
		return null;
	}

	return mapDeleteListItemRow(rows[0]);
};

export const deleteListItems = async (
	itemIds: string[],
	userId: string,
): Promise<DeletedListItem[]> => {
	if (itemIds.length === 0) {
		return [];
	}

	const uniqueItemIds = [...new Set(itemIds)];
	const pool = requirePool();
	const { rows: existingRows } = await pool.query<{ id: string }>(
		`select li.id
     from public.list_items li
     inner join public.lists l on li.list_id = l.id
     where li.id = any($1::text[])
       and ${listVisibilityClause(2)}`,
		[uniqueItemIds, userId],
	);
	if (existingRows.length !== uniqueItemIds.length) {
		return [];
	}

	const { rows, rowCount } = await pool.query<DeleteListItemRow>(
		`delete from public.list_items li
     using public.lists l
     where li.id = any($1::text[]) and li.list_id = l.id
       and ${listVisibilityClause(2)}
     returning li.id as item_id, li.name as item_name, li.list_id, l.name as list_name, l.type as list_type`,
		[uniqueItemIds, userId],
	);
	if ((rowCount ?? 0) === 0 || rows.length === 0) {
		return [];
	}

	return rows.map(mapDeleteListItemRow);
};

export const deleteList = async (listId: string, userId: string): Promise<DeletedList | null> => {
	const pool = requirePool();
	const { rows: listRows } = await pool.query<{ id: string; name: string; type: string }>(
		`select id, name, type from public.lists
     where id = $1::text and ${listVisibilityClause(2)}`,
		[listId, userId],
	);
	if (listRows.length === 0) {
		return null;
	}

	const list = listRows[0];
	const { rows: itemRows } = await pool.query<{ id: string; name: string }>(
		`select id, name from public.list_items where list_id = $1::text order by sort_order`,
		[listId],
	);

	const { rowCount } = await pool.query(
		`delete from public.lists where id = $1::text and ${listVisibilityClause(2)}`,
		[listId, userId],
	);
	if ((rowCount ?? 0) === 0) {
		return null;
	}

	const listType = list.type as DeletedList['listType'];
	const items: DeletedListItem[] = itemRows.map((item) => ({
		itemId: item.id,
		itemName: item.name,
		listId: list.id,
		listName: list.name,
		listType,
	}));

	return {
		listId: list.id,
		listName: list.name,
		listType,
		items,
	};
};
