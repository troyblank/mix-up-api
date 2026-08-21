import { jest } from '@jest/globals';

// In-memory rows shared by GraphQL tests (pool project).
export type MockPgRow = {
	id: string;
	name: string;
	type: string;
	isPrivate: boolean;
	ownerUserId: string | null;
	items: { id: string; name: string }[];
};

export const mockPgRows: MockPgRow[] = [];

export const resetMockPgRows = (): void => {
	mockPgRows.length = 0;
};

const isListVisibleToUser = (row: MockPgRow, userId: string): boolean =>
	!row.isPrivate || row.ownerUserId === userId;

const sqlUsesPlaceholder = (sql: string, n: number): boolean =>
	new RegExp(`\\$${n}(?!\\d)`).test(sql);

const getSqlParam = (sql: string, n: number, params: unknown[]): unknown | undefined => {
	if (!sqlUsesPlaceholder(sql, n)) {
		return undefined;
	}
	return params[n - 1];
};

const mapListMetaRow = (row: MockPgRow) => ({
	id: row.id,
	name: row.name,
	type: row.type,
	is_private: row.isPrivate,
	owner_user_id: row.ownerUserId,
});

// Test double for `pg`; only used when the `pool` Jest project maps `pg` here.
export const Pool = jest.fn().mockImplementation(() => ({
	query: async (sql: string, params?: unknown[]) => {
		if (sql.includes('insert into public.lists') && !sql.includes('list_items')) {
			mockPgRows.push({
				id: params![0] as string,
				name: params![1] as string,
				type: params![2] as string,
				isPrivate: params![3] as boolean,
				ownerUserId: params![4] as string | null,
				items: [],
			});
			return { rows: [], rowCount: 1 };
		}
		if (sql.includes('insert into public.list_items')) {
			const itemId = params![0] as string;
			const listId = params![1] as string;
			const itemName = params![2] as string;
			const userId = sql.includes('is_private = false or owner_user_id')
				? (getSqlParam(sql, 4, params!) as string)
				: undefined;
			const row = mockPgRows.find((r) => r.id === listId);
			if (!row || (userId !== undefined && !isListVisibleToUser(row, userId))) {
				return { rows: [], rowCount: 0 };
			}
			row.items = [...row.items, { id: itemId, name: itemName }];
			return { rows: [], rowCount: 1 };
		}
		if (sql.includes('delete from public.lists') && !sql.includes('list_items')) {
			const listId = params![0] as string;
			const userId = sql.includes('is_private = false or owner_user_id')
				? (getSqlParam(sql, 2, params!) as string)
				: undefined;
			const rowIndex = mockPgRows.findIndex((r) => r.id === listId);
			if (rowIndex === -1) {
				return { rows: [], rowCount: 0 };
			}
			const row = mockPgRows[rowIndex];
			if (userId !== undefined && !isListVisibleToUser(row, userId)) {
				return { rows: [], rowCount: 0 };
			}
			mockPgRows.splice(rowIndex, 1);
			return { rows: [], rowCount: 1 };
		}
		if (
			sql.includes('from public.list_items li') &&
			sql.includes('inner join public.lists l') &&
			sql.includes('li.id = any')
		) {
			const itemIds = params![0] as string[];
			const userId = sql.includes('is_private = false or owner_user_id')
				? (getSqlParam(sql, 2, params!) as string)
				: undefined;
			const rows: { id: string }[] = [];
			for (const itemId of itemIds) {
				for (const row of mockPgRows) {
					if (!row.items.some((i) => i.id === itemId)) {
						continue;
					}
					if (userId !== undefined && !isListVisibleToUser(row, userId)) {
						break;
					}
					rows.push({ id: itemId });
					break;
				}
			}
			return { rows };
		}
		if (sql.includes('delete from public.list_items')) {
			const itemIds = sql.includes('any($1::text[])')
				? (params![0] as string[])
				: [params![0] as string];
			const userId = sql.includes('is_private = false or owner_user_id')
				? (getSqlParam(sql, 2, params!) as string)
				: undefined;
			const deletedRows: {
				item_id: string;
				item_name: string;
				list_id: string;
				list_name: string;
				list_type: string;
			}[] = [];

			for (const itemId of itemIds) {
				for (const row of mockPgRows) {
					const itemIndex = row.items.findIndex((i) => i.id === itemId);
					if (itemIndex === -1) {
						continue;
					}
					if (userId !== undefined && !isListVisibleToUser(row, userId)) {
						break;
					}
					const deletedItem = row.items[itemIndex];
					row.items = [
						...row.items.slice(0, itemIndex),
						...row.items.slice(itemIndex + 1),
					];
					deletedRows.push({
						item_id: deletedItem.id,
						item_name: deletedItem.name,
						list_id: row.id,
						list_name: row.name,
						list_type: row.type,
					});
					break;
				}
			}

			return { rows: deletedRows, rowCount: deletedRows.length };
		}
		if (sql.includes('from public.lists') && sql.includes('order by id')) {
			const userId = getSqlParam(sql, 1, params!) as string;
			return {
				rows: mockPgRows
					.filter((row) => isListVisibleToUser(row, userId))
					.map(mapListMetaRow),
			};
		}
		if (
			sql.includes('from public.lists') &&
			sql.includes('where id = $1') &&
			sql.includes('is_private = false or owner_user_id')
		) {
			const id = getSqlParam(sql, 1, params!) as string;
			const userId = getSqlParam(sql, 2, params!) as string;
			const row = mockPgRows.find((r) => r.id === id && isListVisibleToUser(r, userId));
			return { rows: row ? [mapListMetaRow(row)] : [] };
		}
		if (sql.includes('from public.lists where id = $1') && !sql.includes('list_items')) {
			const id = getSqlParam(sql, 1, params!) as string;
			const userId = sql.includes('is_private = false or owner_user_id')
				? (getSqlParam(sql, 2, params!) as string)
				: undefined;
			const row = mockPgRows.find(
				(r) =>
					r.id === id &&
					(userId === undefined || isListVisibleToUser(r, userId)),
			);
			return { rows: row ? [mapListMetaRow(row)] : [] };
		}
		if (sql.includes('from public.list_items where list_id = $1')) {
			const listId = params![0] as string;
			const row = mockPgRows.find((r) => r.id === listId);
			const items = row?.items ?? [];
			return {
				rows: items.map((i) => ({ id: i.id, name: i.name })),
			};
		}
		if (sql.includes('from public.list_items where list_id = any')) {
			const ids = params![0] as string[];
			const rows: { id: string; name: string; list_id: string }[] = [];
			for (const listId of ids) {
				const row = mockPgRows.find((r) => r.id === listId);
				const items = row?.items ?? [];
				for (const i of items) {
					rows.push({ id: i.id, name: i.name, list_id: listId });
				}
			}
			return { rows };
		}
		return { rows: [] };
	},
}));

const pg = { Pool };

export default pg;
