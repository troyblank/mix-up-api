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

/** Test double for `pg`; only used when the `pool` Jest project maps `pg` here. */
export const Pool = jest.fn().mockImplementation(() => ({
	query: async (sql: string, params?: unknown[]) => {
		if (sql.includes('insert into public.lists')) {
			mockPgRows.push({
				id: params![0] as string,
				name: params![1] as string,
				type: params![2] as string,
				items: JSON.parse(params![3] as string),
			});
			return { rows: [] };
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
