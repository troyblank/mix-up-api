import { cookBooks, movies, middara } from '../data/index.ts';
import { type List, type ListItem } from '../generated/types.ts';
import { requirePool } from './pool.ts';

type ID = string;

type ListMetaRow = {
	id: string;
	name: string;
	type: string;
};

type ListItemRow = {
	id: string;
	name: string;
	list_id: string;
};

export const INITIAL_LISTS: List[] = [
	{
		id: '2',
		name: 'Movies',
		type: 'pick',
		items: movies,
	},
	{
		id: '4',
		name: 'Cook Books',
		type: 'pick',
		items: cookBooks,
	},
	{
		id: '3',
		name: 'Middara',
		type: 'list',
		items: middara,
	},
];

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

export const fetchListsFromDb = async (): Promise<List[]> => {
	const pool = requirePool();

	const { rows: listRows } = await pool.query<ListMetaRow>(
		`select id, name, type from public.lists order by id`,
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
		id: row.id,
		name: row.name,
		type: row.type as List['type'],
		items: itemsByList.get(row.id) ?? [],
	}));
};

export const fetchListByIdFromDb = async (id: string): Promise<List | undefined> => {
	const pool = requirePool();
	const { rows: listRows } = await pool.query<ListMetaRow>(
		`select id, name, type from public.lists where id = $1`,
		[id],
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
		id: meta.id,
		name: meta.name,
		type: meta.type as List['type'],
		items: itemRows.map((row) => ({ id: row.id, name: row.name })),
	};
};

export const getLists = async (): Promise<List[]> => {
	const fromDb = await fetchListsFromDb();

	return [...INITIAL_LISTS, ...fromDb];
};

export const getListsById = async (id: ID): Promise<List | null> => {
	return (await fetchListByIdFromDb(id)) ?? null;
};
