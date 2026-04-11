import { jest } from '@jest/globals';

// In-memory rows shared by GraphQL tests (pool project).
export type MockPgRow = {
	id: string;
	name: string;
	type: string;
	items: { id: string; name: string }[];
};

export const mockPgRows: MockPgRow[] = [];

export const resetMockPgRows = (): void => {
	mockPgRows.length = 0;
};

// Test double for `pg`; only used when the `pool` Jest project maps `pg` here.
export const Pool = jest.fn().mockImplementation(() => ({
	query: async (sql: string, params?: unknown[]) => {
		if (sql.includes('insert into public.lists') && !sql.includes('list_items')) {
			mockPgRows.push({
				id: params![0] as string,
				name: params![1] as string,
				type: params![2] as string,
				items: [],
			});
			return { rows: [], rowCount: 1 };
		}
		if (sql.includes('insert into public.list_items')) {
			const itemId = params![0] as string;
			const listId = params![1] as string;
			const itemName = params![2] as string;
			const row = mockPgRows.find((r) => r.id === listId);
			if (row) {
				row.items = [...row.items, { id: itemId, name: itemName }];
				return { rows: [], rowCount: 1 };
			}
			return { rows: [], rowCount: 0 };
		}
		if (sql.includes('from public.lists order by')) {
			return { rows: mockPgRows.map((r) => ({ ...r, items: undefined })) };
		}
		if (sql.includes('from public.lists where id = $1') && !sql.includes('list_items')) {
			const id = params![0] as string;
			const row = mockPgRows.find((r) => r.id === id);
			return { rows: row ? [{ id: row.id, name: row.name, type: row.type }] : [] };
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
