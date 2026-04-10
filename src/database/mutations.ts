import { type List, type ListItem } from '../generated/types.ts';
import { requirePool } from './pool.ts';

export const addList = async (list: List): Promise<void> => {
	const pool = requirePool();

	await pool.query(
		`insert into public.lists (id, name, type, items)
     values ($1, $2, $3, $4::jsonb)`,
		[list.id, list.name, list.type, JSON.stringify(list.items)],
	);
};

export const appendListItem = async (listId: string, item: ListItem): Promise<boolean> => {
	const pool = requirePool();
	const { rowCount } = await pool.query(
		`update public.lists
     set items = items || $2::jsonb
     where id = $1`,
		[listId, JSON.stringify([item])],
	);
	return (rowCount ?? 0) > 0;
};
