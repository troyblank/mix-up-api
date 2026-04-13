import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import Chance from 'chance';
import { resetMockPgRows } from './__mocks__/pg.ts';

const chance = new Chance();
const originalDatabaseUrl = process.env.DATABASE_URL;

describe('Database queries', () => {
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

	it('Groups multiple item rows for the same list when loading from the database.', async () => {
		const { addList, appendListItem } = await import('./mutations.ts');
		const { fetchListsFromDb, getLists, getListsById } = await import('./queries.ts');

		const listId = chance.guid();
		const listName = chance.sentence({ words: 3 });
		const listType = chance.pickone(['pick', 'list'] as const);
		const [firstItemName, secondItemName] = chance.unique(chance.word, 2);

		await addList({ id: listId, name: listName, type: listType, items: [] });
		await appendListItem(listId, { id: chance.guid(), name: firstItemName });
		await appendListItem(listId, { id: chance.guid(), name: secondItemName });

		const lists = await fetchListsFromDb();
		const databaseList = lists.find((list) => list.id === listId);
		expect(databaseList?.items).toHaveLength(2);
		expect(databaseList?.items.map((item) => item.name)).toEqual([
			firstItemName,
			secondItemName,
		]);

		const mergedLists = await getLists();
		expect(mergedLists.some((list) => list.id === listId)).toBe(true);

		const listById = await getListsById(listId);
		expect(listById?.items).toHaveLength(2);
	});

	it('Returns an empty array when the database has no lists.', async () => {
		const { fetchListsFromDb } = await import('./queries.ts');
		await expect(fetchListsFromDb()).resolves.toEqual([]);
	});
});
