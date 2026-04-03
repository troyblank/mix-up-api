import { type List } from '../generated/types.ts';
import { requirePool } from './pool.ts';

export const insertList = async (list: List): Promise<void> => {
	const pool = requirePool();

	await pool.query(
		`insert into public.lists (id, name, type, items)
     values ($1, $2, $3, $4::jsonb)`,
		[list.id, list.name, list.type, JSON.stringify(list.items)],
	);
};

export const addList = async (list: List): Promise<void> => {
	await insertList(list);
};
