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

		await expect(deleteListItem('any-id')).resolves.toBeNull();
		query.mockRestore();
	});

	it('Returns deleted item and list metadata when a row is removed.', async () => {
		const { addList, appendListItem, deleteListItem } = await import('./mutations.ts');

		await addList({ id: 'l1', name: 'Movies', type: 'pick', items: [] });
		await appendListItem('l1', { id: 'i1', name: 'Inception' });

		await expect(deleteListItem('i1')).resolves.toEqual({
			itemId: 'i1',
			itemName: 'Inception',
			listId: 'l1',
			listName: 'Movies',
			listType: 'pick',
		});
	});

	it('Returns deleted items and list metadata when multiple rows are removed.', async () => {
		const { addList, appendListItem, deleteListItems } = await import('./mutations.ts');

		await addList({ id: 'l1', name: 'Movies', type: 'list', items: [] });
		await appendListItem('l1', { id: 'i1', name: 'Inception' });
		await appendListItem('l1', { id: 'i2', name: 'Interstellar' });
		await appendListItem('l1', { id: 'i3', name: 'Tenet' });

		await expect(deleteListItems(['i1', 'i3'])).resolves.toEqual([
			{
				itemId: 'i1',
				itemName: 'Inception',
				listId: 'l1',
				listName: 'Movies',
				listType: 'list',
			},
			{
				itemId: 'i3',
				itemName: 'Tenet',
				listId: 'l1',
				listName: 'Movies',
				listType: 'list',
			},
		]);
	});

	it('Returns an empty array when deleteListItems is called with no ids.', async () => {
		const { deleteListItems } = await import('./mutations.ts');

		await expect(deleteListItems([])).resolves.toEqual([]);
	});
});
