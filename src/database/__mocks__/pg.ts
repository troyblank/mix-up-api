import { jest } from '@jest/globals';

// In-memory rows shared by GraphQL tests (pool project).
export type MockPgRow = {
	id: string;
	name: string;
	type: string;
	items: unknown;
};

export const mockPgRows: MockPgRow[] = [];

export const resetMockPgRows = (): void => {
	mockPgRows.length = 0;
};

// Test double for `pg`; only used when the `pool` Jest project maps `pg` here.
export const Pool = jest.fn().mockImplementation(() => ({
	query: async (sql: string, params?: unknown[]) => {
		if (sql.includes('insert into public.lists')) {
			mockPgRows.push({
				id: params![0] as string,
				name: params![1] as string,
				type: params![2] as string,
				items: JSON.parse(params![3] as string),
			});
			return { rows: [], rowCount: 1 };
		}
		if (sql.includes('update public.lists') && sql.includes('items = items ||')) {
			const id = params![0] as string;
			const appended = JSON.parse(params![1] as string) as unknown[];
			const row = mockPgRows.find((r) => r.id === id);
			if (row) {
				const existing = Array.isArray(row.items) ? (row.items as unknown[]) : [];
				row.items = [...existing, ...appended];
				return { rows: [], rowCount: 1 };
			}
			return { rows: [], rowCount: 0 };
		}
		if (sql.includes('from public.lists order by')) {
			return { rows: mockPgRows.map((r) => ({ ...r })) };
		}
		if (sql.includes('where id = $1')) {
			const id = params![0] as string;
			const row = mockPgRows.find((r) => r.id === id);
			return { rows: row ? [{ ...row }] : [] };
		}
		return { rows: [] };
	},
}));

const pg = { Pool };

export default pg;
