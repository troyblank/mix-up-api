import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { resetMockPgRows } from './__mocks__/pg.ts';

const originalDatabaseUrl = process.env.DATABASE_URL;

describe('Database mutations', () => {
	beforeEach(() => {
		resetMockPgRows();
		process.env.DATABASE_URL = 'postgresql://test';
	});

	afterEach(() => {
		if (originalDatabaseUrl === undefined) {
			delete process.env.DATABASE_URL;
		} else {
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
		jest.resetModules();
	});

	it('Treats a missing rowCount on append as no rows affected.', async () => {
		const { addList, appendListItem } = await import('./mutations.ts');
		const { requirePool } = await import('./pool.ts');

		await addList({ id: 'l1', name: 'L', type: 'pick', items: [] });
		const pool = requirePool();
		const query = jest.spyOn(pool, 'query').mockImplementationOnce(async () => ({
			rows: [],
			rowCount: undefined,
		}));

		await expect(appendListItem('l1', { id: 'i1', name: 'item' })).resolves.toBe(false);
		query.mockRestore();
	});

	it('Treats a missing rowCount on delete as no rows affected.', async () => {
		const { deleteListItem } = await import('./mutations.ts');
		const { requirePool } = await import('./pool.ts');
		const pool = requirePool();
		const query = jest.spyOn(pool, 'query').mockImplementationOnce(async () => ({
			rows: [],
			rowCount: undefined,
		}));

		await expect(deleteListItem('any-id')).resolves.toBe(false);
		query.mockRestore();
	});
});
