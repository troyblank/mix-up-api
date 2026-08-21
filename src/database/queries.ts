import { type List, type ListItem } from '../generated/types.ts';
import { listVisibilityClause } from './listAccess.ts';
import { requirePool } from './pool.ts';

type ID = string;

type ListMetaRow = {
	id: string;
	name: string;
	type: string;
	is_private: boolean;
	owner_user_id: string | null;
};

type ListItemRow = {
	id: string;
	name: string;
	list_id: string;
};

const mapItemRowsToByListId = (itemRows: ListItemRow[]): Map<string, ListItem[]> => {
	const map = new Map<string, ListItem[]>();
	for (const row of itemRows) {
		const listId = row.list_id;
		const list = map.get(listId) ?? [];
		list.push({ id: row.id, name: row.name });
		map.set(listId, list);
	}
	return map;
};

const mapListMetaRow = (row: ListMetaRow): Omit<List, 'items'> => ({
	id: row.id,
	name: row.name,
	type: row.type as List['type'],
	isPrivate: row.is_private,
});

export const fetchListsFromDb = async (userId: string): Promise<List[]> => {
	const pool = requirePool();

	const { rows: listRows } = await pool.query<ListMetaRow>(
		`select id, name, type, is_private, owner_user_id
     from public.lists
     where ${listVisibilityClause(1)}
     order by id`,
		[userId],
	);

	if (listRows.length === 0) {
		return [];
	}

	const ids = listRows.map((r) => r.id);
	const { rows: itemRows } = await pool.query<ListItemRow>(
		`select id, name, list_id from public.list_items where list_id = any($1::text[]) order by list_id, sort_order`,
		[ids],
	);

	const itemsByList = mapItemRowsToByListId(itemRows);

	return listRows.map((row) => ({
		...mapListMetaRow(row),
		items: itemsByList.get(row.id) ?? [],
	}));
};

export const fetchListByIdFromDb = async (
	id: string,
	userId: string,
): Promise<List | undefined> => {
	const pool = requirePool();
	const { rows: listRows } = await pool.query<ListMetaRow>(
		`select id, name, type, is_private, owner_user_id
     from public.lists
     where id = $1 and ${listVisibilityClause(2)}`,
		[id, userId],
	);
	const meta = listRows[0];
	if (!meta) {
		return undefined;
	}

	const { rows: itemRows } = await pool.query<Omit<ListItemRow, 'list_id'>>(
		`select id, name from public.list_items where list_id = $1 order by sort_order`,
		[id],
	);

	return {
		...mapListMetaRow(meta),
		items: itemRows.map((row) => ({ id: row.id, name: row.name })),
	};
};

export const getLists = async (userId: string): Promise<List[]> => {
	return fetchListsFromDb(userId);
};

export const getListsById = async (id: ID, userId: string): Promise<List | null> => {
	return (await fetchListByIdFromDb(id, userId)) ?? null;
};
