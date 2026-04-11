import { type List, type ListItem } from '../generated/types.ts';
import { requirePool } from './pool.ts';

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
