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

		await addList({ id: 'l1', name: 'L', type: 'pick', isPrivate: false, items: [] }, null);
		const pool = requirePool();
		const query = jest.spyOn(pool, 'query').mockImplementationOnce(async () => ({
			rows: [],
			rowCount: undefined,
		}));

		await expect(appendListItem('l1', { id: 'i1', name: 'item' }, 'test-user')).resolves.toBe(false);
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

		await expect(deleteListItem('any-id', 'test-user')).resolves.toBeNull();
		query.mockRestore();
	});

	it('Returns deleted item and list metadata when a row is removed.', async () => {
		const { addList, appendListItem, deleteListItem } = await import('./mutations.ts');

		await addList({ id: 'l1', name: 'Movies', type: 'pick', isPrivate: false, items: [] }, null);
		await appendListItem('l1', { id: 'i1', name: 'Inception' }, 'test-user');

		await expect(deleteListItem('i1', 'test-user')).resolves.toEqual({
			itemId: 'i1',
			itemName: 'Inception',
			listId: 'l1',
			listName: 'Movies',
			listType: 'pick',
		});
	});

	it('Returns deleted items and list metadata when multiple rows are removed.', async () => {
		const { addList, appendListItem, deleteListItems } = await import('./mutations.ts');

		await addList({ id: 'l1', name: 'Movies', type: 'list', isPrivate: false, items: [] }, null);
		await appendListItem('l1', { id: 'i1', name: 'Inception' }, 'test-user');
		await appendListItem('l1', { id: 'i2', name: 'Interstellar' }, 'test-user');
		await appendListItem('l1', { id: 'i3', name: 'Tenet' }, 'test-user');

		await expect(deleteListItems(['i1', 'i3'], 'test-user')).resolves.toEqual([
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

		await expect(deleteListItems([], 'test-user')).resolves.toEqual([]);
	});

	it('Returns an empty array when deleteListItems targets items that do not all exist.', async () => {
		const { addList, appendListItem, deleteListItems } = await import('./mutations.ts');

		await addList({ id: 'l1', name: 'Movies', type: 'list', isPrivate: false, items: [] }, null);
		await appendListItem('l1', { id: 'i1', name: 'Inception' }, 'test-user');

		await expect(deleteListItems(['i1', 'missing'], 'test-user')).resolves.toEqual([]);
	});

	it('Treats a missing rowCount on deleteListItems as no rows affected.', async () => {
		const { addList, appendListItem, deleteListItems } = await import('./mutations.ts');
		const { requirePool } = await import('./pool.ts');

		await addList({ id: 'l1', name: 'Movies', type: 'list', isPrivate: false, items: [] }, null);
		await appendListItem('l1', { id: 'i1', name: 'Inception' }, 'test-user');
		const pool = requirePool();
		const query = jest.spyOn(pool, 'query');
		query
			.mockImplementationOnce(async () => ({
				rows: [{ id: 'i1' }],
				rowCount: 1,
			}))
			.mockImplementationOnce(async () => ({
				rows: [],
				rowCount: undefined,
			}));

		await expect(deleteListItems(['i1'], 'test-user')).resolves.toEqual([]);
		query.mockRestore();
	});

	it('Returns an empty array when deleteListItems delete query returns no rows.', async () => {
		const { addList, appendListItem, deleteListItems } = await import('./mutations.ts');
		const { requirePool } = await import('./pool.ts');

		await addList({ id: 'l1', name: 'Movies', type: 'list', isPrivate: false, items: [] }, null);
		await appendListItem('l1', { id: 'i1', name: 'Inception' }, 'test-user');
		const pool = requirePool();
		const query = jest.spyOn(pool, 'query');
		query
			.mockImplementationOnce(async () => ({
				rows: [{ id: 'i1' }],
				rowCount: 1,
			}))
			.mockImplementationOnce(async () => ({
				rows: [],
				rowCount: 1,
			}));

		await expect(deleteListItems(['i1'], 'test-user')).resolves.toEqual([]);
		query.mockRestore();
	});

	it('Treats a missing rowCount on deleteList as no rows affected.', async () => {
		const { addList, deleteList } = await import('./mutations.ts');
		const { requirePool } = await import('./pool.ts');

		await addList({ id: 'l1', name: 'Movies', type: 'pick', isPrivate: false, items: [] }, null);
		const pool = requirePool();
		const query = jest.spyOn(pool, 'query');
		query
			.mockImplementationOnce(async () => ({
				rows: [{ id: 'l1', name: 'Movies', type: 'pick' }],
				rowCount: 1,
			}))
			.mockImplementationOnce(async () => ({
				rows: [],
				rowCount: 0,
			}))
			.mockImplementationOnce(async () => ({
				rows: [],
				rowCount: undefined,
			}));

		await expect(deleteList('l1', 'test-user')).resolves.toBeNull();
		query.mockRestore();
	});

	it('Returns deleted list metadata and items when a list is removed.', async () => {
		const { addList, appendListItem, deleteList } = await import('./mutations.ts');

		await addList({ id: 'l1', name: 'Movies', type: 'pick', isPrivate: false, items: [] }, null);
		await appendListItem('l1', { id: 'i1', name: 'Inception' }, 'test-user');
		await appendListItem('l1', { id: 'i2', name: 'Interstellar' }, 'test-user');

		await expect(deleteList('l1', 'test-user')).resolves.toEqual({
			listId: 'l1',
			listName: 'Movies',
			listType: 'pick',
			items: [
				{
					itemId: 'i1',
					itemName: 'Inception',
					listId: 'l1',
					listName: 'Movies',
					listType: 'pick',
				},
				{
					itemId: 'i2',
					itemName: 'Interstellar',
					listId: 'l1',
					listName: 'Movies',
					listType: 'pick',
				},
			],
		});
	});

	it('Returns null when deleteList targets a list that does not exist.', async () => {
		const { deleteList } = await import('./mutations.ts');

		await expect(deleteList('no-such-list', 'test-user')).resolves.toBeNull();
	});

	it('Rejects mutations on private lists from non-owners.', async () => {
		const { addList, appendListItem, deleteListItem, deleteListItems, deleteList } =
			await import('./mutations.ts');

		const ownerId = 'owner-user';
		const otherUserId = 'other-user';

		await addList(
			{ id: 'private-list', name: 'Secret', type: 'list', isPrivate: true, items: [] },
			ownerId,
		);
		await appendListItem('private-list', { id: 'item-1', name: 'Hidden' }, ownerId);

		await expect(
			appendListItem('private-list', { id: 'item-2', name: 'Intruder' }, otherUserId),
		).resolves.toBe(false);
		await expect(deleteListItem('item-1', otherUserId)).resolves.toBeNull();
		await expect(deleteListItems(['item-1'], otherUserId)).resolves.toEqual([]);
		await expect(deleteList('private-list', otherUserId)).resolves.toBeNull();

		await expect(
			appendListItem('private-list', { id: 'item-2', name: 'Allowed' }, ownerId),
		).resolves.toBe(true);
		await expect(deleteListItem('item-1', ownerId)).resolves.toMatchObject({
			itemId: 'item-1',
			listId: 'private-list',
		});
	});
});
