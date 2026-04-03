import { comedies, cookBooks, movies, shows, middara } from '../data/index.ts';
import { type List } from '../generated/types.ts';
import { requirePool } from './pool.ts';

type ID = string;
type ListRow = {
	id: string;
	name: string;
	type: string;
	items: unknown;
};

export const INITIAL_LISTS: List[] = [
	{
		id: '1',
		name: 'TV Shows',
		type: 'pick',
		items: shows,
	},
	{
		id: '5',
		name: 'Comedies',
		type: 'pick',
		items: comedies,
	},
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

const convertDatabaseRowToList = (row: ListRow): List => {
	const items = Array.isArray(row.items) ? row.items : [];
	return {
		id: row.id,
		name: row.name,
		type: row.type as List['type'],
		items: items.map((item) => {
			const { id, name} = item as { id: string; name: string };
			return { id, name };
		}),
	};
};

export const fetchListsFromDb = async (): Promise<List[]> => {
	const pool = requirePool();

	const { rows } = await pool.query<ListRow>(
		`select id, name, type, items from public.lists order by id`,
	);

	return rows.map(convertDatabaseRowToList);
};

export const fetchListByIdFromDb = async (id: string): Promise<List | undefined> => {
	const pool = requirePool();
	const { rows } = await pool.query<ListRow>(
		`select id, name, type, items from public.lists where id = $1`,
		[id],
	);
	const row = rows[0];
	return row ? convertDatabaseRowToList(row) : undefined;
};

export const getLists = async (): Promise<List[]> => {
	const fromDb = await fetchListsFromDb();

	return [...INITIAL_LISTS, ...fromDb];
};

export const getListsById = async (id: ID): Promise<List | null> => {
	return (await fetchListByIdFromDb(id)) ?? null;
};
