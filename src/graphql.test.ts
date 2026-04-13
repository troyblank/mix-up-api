import Chance from 'chance';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { resetMockPgRows } from './database/__mocks__/pg.ts';

const chance = new Chance();

describe('GraphQL API', () => {
	let server: Awaited<typeof import('./graphql.js')>['server'];

	beforeAll(async () => {
		process.env.DATABASE_URL = 'postgresql://test';
		const graphql = await import('./graphql.js');
		server = graphql.server;
		await server.start();
	});

	afterAll(async () => {
		delete process.env.DATABASE_URL;
		await server.stop();
	});

	beforeEach(() => {
		resetMockPgRows();
	});

	it('Should return all lists with id and name.', async () => {
		const result = await server.executeOperation({
			query: `
				query {
					lists {
						id
						name
					}
				}
			`,
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		const singleResponseBody = result.body;
		expect(singleResponseBody.singleResult.errors).toBeUndefined();
		const listsFromGraphQLQueryResponse = singleResponseBody.singleResult.data?.lists as {
			id: string;
			name: string;
		}[];
		expect(listsFromGraphQLQueryResponse).toBeDefined();
		expect(Array.isArray(listsFromGraphQLQueryResponse)).toBe(true);
		expect(listsFromGraphQLQueryResponse.length).toBeGreaterThan(0);
		listsFromGraphQLQueryResponse.forEach((list) => {
			expect(list).toHaveProperty('id');
			expect(list).toHaveProperty('name');
			expect(typeof list.id).toBe('string');
			expect(typeof list.name).toBe('string');
		});
	});

	it('Returns null when no list matches the id.', async () => {
		const result = await server.executeOperation({
			query: `
				query {
					list(id: "no-such-list-id") {
						id
					}
				}
			`,
		});

		if (result.body.kind !== 'single') throw new Error('Expected single result');
		expect(result.body.singleResult.errors).toBeUndefined();
		expect(result.body.singleResult.data?.list).toBeNull();
	});

	it('Should return a single list by id.', async () => {
		const listsResult = await server.executeOperation({
			query: `query { lists { id name } }`,
		});
		if (listsResult.body.kind !== 'single') throw new Error('Expected single result');
		const listsFromGraphQLQueryResponse = (listsResult.body.singleResult.data as {
			lists: { id: string; name: string }[];
		})?.lists;
		const firstListFromSeededListsQuery = listsFromGraphQLQueryResponse[0];

		const result = await server.executeOperation({
			query: `
				query GetList($id: ID!) {
					list(id: $id) {
						id
						name
					}
				}
			`,
			variables: { id: firstListFromSeededListsQuery.id },
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		const singleResponseBody = result.body;
		expect(singleResponseBody.singleResult.errors).toBeUndefined();
		expect(singleResponseBody.singleResult.data?.list).toEqual({
			id: firstListFromSeededListsQuery.id,
			name: firstListFromSeededListsQuery.name,
		});
	});

	it('Should return list with items when requested.', async () => {
		const listsResult = await server.executeOperation({
			query: `query { lists { id name items { id name } } }`,
		});
		if (listsResult.body.kind !== 'single') throw new Error('Expected single result');
		const listsFromGraphQLQueryResponse = (listsResult.body.singleResult.data as {
			lists: { id: string; name: string; items: { id: string; name: string }[] }[];
		})?.lists;
		const seededListThatIncludesItems = listsFromGraphQLQueryResponse[1];

		const result = await server.executeOperation({
			query: `
				query GetListWithItems($id: ID!) {
					list(id: $id) {
						id
						name
						items {
							id
							name
						}
					}
				}
			`,
			variables: { id: seededListThatIncludesItems.id },
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		const singleResponseBody = result.body;
		const listFromListFieldQuery = singleResponseBody.singleResult.data?.list as {
			id: string;
			name: string;
			items: { id: string; name: string }[];
		};

		expect(singleResponseBody.singleResult.errors).toBeUndefined();
		expect(listFromListFieldQuery.id).toBe(seededListThatIncludesItems.id);
		expect(listFromListFieldQuery.name).toBe(seededListThatIncludesItems.name);
		expect(Array.isArray(listFromListFieldQuery.items)).toBe(true);
		expect(listFromListFieldQuery.items.length).toBe(seededListThatIncludesItems.items.length);
		expect(listFromListFieldQuery.items[0]).toHaveProperty('id');
		expect(listFromListFieldQuery.items[0]).toHaveProperty('name');
	});

	it('Should reject createNewList when authentication is not present on the context.', async () => {
		const input = {
			name: chance.sentence({ words: 3 }),
			type: chance.pickone(['pick', 'list'] as const),
		};

		const result = await server.executeOperation({
			query: `
				mutation CreateNewList($input: CreateListInput!) {
					createNewList(input: $input) {
						id
					}
				}
			`,
			variables: { input },
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		const singleResponseBody = result.body;
		expect(singleResponseBody.singleResult.data?.createNewList).toBeUndefined();
		expect(singleResponseBody.singleResult.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
	});

	it('Should create a new list via createNewList mutation.', async () => {
		const input = {
			name: chance.sentence({ words: 3 }),
			type: chance.pickone(['pick', 'list'] as const),
		};

		const result = await server.executeOperation(
			{
				query: `
				mutation CreateNewList($input: CreateListInput!) {
					createNewList(input: $input) {
						id
						name
						type
						items {
							id
							name
						}
					}
				}
			`,
				variables: { input },
			},
			{ contextValue: { cognito: { sub: chance.guid() } } },
		);

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		const singleResponseBody = result.body;
		expect(singleResponseBody.singleResult.errors).toBeUndefined();
		const createdList = singleResponseBody.singleResult.data?.createNewList as {
			id: string;
			name: string;
			type: string;
			items: unknown[];
		};
		expect(createdList).toMatchObject({
			name: input.name,
			type: input.type,
		});
		expect(createdList.items).toEqual([]);
		expect(typeof createdList.id).toBe('string');

		const listsAfter = await server.executeOperation({
			query: `query { lists { id name } }`,
		});

		if (listsAfter.body.kind !== 'single') throw new Error('Expected single result');
		const allLists = (listsAfter.body.singleResult.data as { lists: { id: string; name: string }[] })?.lists;

		expect(
			allLists.some(
				(list) => list.id === createdList.id && list.name === createdList.name,
			),
		).toBe(true);

		const fetchListByIdentifierResult = await server.executeOperation({
			query: `
				query GetCreated($id: ID!) {
					list(id: $id) {
						id
						name
						type
					}
				}
			`,
			variables: { id: createdList.id },
		});

		if (fetchListByIdentifierResult.body.kind !== 'single') {
			throw new Error('Expected single result');
		}
		expect(fetchListByIdentifierResult.body.singleResult.errors).toBeUndefined();
		expect(fetchListByIdentifierResult.body.singleResult.data?.list).toEqual({
			id: createdList.id,
			name: input.name,
			type: input.type,
		});
	});

	it('Should reject insertListItem when authentication is not present on the context.', async () => {
		const result = await server.executeOperation({
			query: `
				mutation InsertItem($input: InsertListItemInput!) {
					insertListItem(input: $input) {
						id
					}
				}
			`,
			variables: {
				input: { listId: 'placeholder-list-identifier', name: chance.word() },
			},
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		const singleResponseBody = result.body;
		expect(singleResponseBody.singleResult.data?.insertListItem).toBeUndefined();
		expect(singleResponseBody.singleResult.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
	});

	it('Should return NOT_FOUND when insertListItem targets a list that is not in the database.', async () => {
		const result = await server.executeOperation(
			{
				query: `
					mutation InsertItem($input: InsertListItemInput!) {
						insertListItem(input: $input) {
							id
							name
						}
					}
				`,
				variables: {
					input: { listId: chance.guid(), name: chance.word() },
				},
			},
			{ contextValue: { cognito: { sub: chance.guid() } } },
		);

		if (result.body.kind !== 'single') throw new Error('Expected single result');
		expect(result.body.singleResult.data?.insertListItem).toBeUndefined();
		expect(result.body.singleResult.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
	});

	it('Should add a list item via insertListItem and expose it on list query.', async () => {
		const listInput = {
			name: chance.sentence({ words: 3 }),
			type: chance.pickone(['pick', 'list'] as const),
		};

		const createResult = await server.executeOperation(
			{
				query: `
					mutation CreateNewList($input: CreateListInput!) {
						createNewList(input: $input) {
							id
						}
					}
				`,
				variables: { input: listInput },
			},
			{ contextValue: { cognito: { sub: chance.guid() } } },
		);

		if (createResult.body.kind !== 'single') throw new Error('Expected single result');
		const listId = (createResult.body.singleResult.data as { createNewList: { id: string } })
			.createNewList.id;

		const itemName = chance.sentence({ words: 2 });

		const insertResult = await server.executeOperation(
			{
				query: `
					mutation InsertItem($input: InsertListItemInput!) {
						insertListItem(input: $input) {
							id
							name
						}
					}
				`,
				variables: {
					input: { listId, name: itemName },
				},
			},
			{ contextValue: { cognito: { sub: chance.guid() } } },
		);

		if (insertResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(insertResult.body.singleResult.errors).toBeUndefined();
		const insertedListItem = insertResult.body.singleResult.data?.insertListItem as {
			id: string;
			name: string;
		};
		expect(insertedListItem.name).toBe(itemName);
		expect(typeof insertedListItem.id).toBe('string');

		const listResult = await server.executeOperation({
			query: `
				query GetList($id: ID!) {
					list(id: $id) {
						items {
							id
							name
						}
					}
				}
			`,
			variables: { id: listId },
		});

		if (listResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(listResult.body.singleResult.errors).toBeUndefined();
		const items = (listResult.body.singleResult.data?.list as { items: { id: string; name: string }[] })
			.items;
		expect(
			items.some(
				(item) => item.id === insertedListItem.id && item.name === itemName,
			),
		).toBe(true);
	});

	it('Should reject deleteListItem when authentication is not present on the context.', async () => {
		const result = await server.executeOperation({
			query: `
				mutation DeleteItem($input: DeleteListItemInput!) {
					deleteListItem(input: $input)
				}
			`,
			variables: {
				input: { itemId: 'placeholder-item-identifier' },
			},
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		const singleResponseBody = result.body;
		expect(singleResponseBody.singleResult.data?.deleteListItem).toBeUndefined();
		expect(singleResponseBody.singleResult.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
	});

	it('Should return NOT_FOUND when deleteListItem targets a list item that does not exist.', async () => {
		const result = await server.executeOperation(
			{
				query: `
					mutation DeleteItem($input: DeleteListItemInput!) {
						deleteListItem(input: $input)
					}
				`,
				variables: {
					input: { itemId: chance.guid() },
				},
			},
			{ contextValue: { cognito: { sub: chance.guid() } } },
		);

		if (result.body.kind !== 'single') throw new Error('Expected single result');
		expect(result.body.singleResult.data?.deleteListItem).toBeUndefined();
		expect(result.body.singleResult.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
	});

	it('Should remove a list item via deleteListItem and omit it from the list query.', async () => {
		const listInput = {
			name: chance.sentence({ words: 3 }),
			type: chance.pickone(['pick', 'list'] as const),
		};

		const createResult = await server.executeOperation(
			{
				query: `
					mutation CreateNewList($input: CreateListInput!) {
						createNewList(input: $input) {
							id
						}
					}
				`,
				variables: { input: listInput },
			},
			{ contextValue: { cognito: { sub: chance.guid() } } },
		);

		if (createResult.body.kind !== 'single') throw new Error('Expected single result');
		const listId = (createResult.body.singleResult.data as { createNewList: { id: string } })
			.createNewList.id;

		const insertResult = await server.executeOperation(
			{
				query: `
					mutation InsertItem($input: InsertListItemInput!) {
						insertListItem(input: $input) {
							id
							name
						}
					}
				`,
				variables: {
					input: { listId, name: chance.sentence({ words: 2 }) },
				},
			},
			{ contextValue: { cognito: { sub: chance.guid() } } },
		);

		if (insertResult.body.kind !== 'single') throw new Error('Expected single result');
		const itemId = (insertResult.body.singleResult.data as { insertListItem: { id: string } })
			.insertListItem.id;

		const deleteResult = await server.executeOperation(
			{
				query: `
					mutation DeleteItem($input: DeleteListItemInput!) {
						deleteListItem(input: $input)
					}
				`,
				variables: {
					input: { itemId },
				},
			},
			{ contextValue: { cognito: { sub: chance.guid() } } },
		);

		if (deleteResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(deleteResult.body.singleResult.errors).toBeUndefined();
		expect(deleteResult.body.singleResult.data?.deleteListItem).toBe(true);

		const listResult = await server.executeOperation({
			query: `
				query GetList($id: ID!) {
					list(id: $id) {
						items {
							id
						}
					}
				}
			`,
			variables: { id: listId },
		});

		if (listResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(listResult.body.singleResult.errors).toBeUndefined();
		const items = (listResult.body.singleResult.data?.list as { items: { id: string }[] }).items;
		expect(items.some((item) => item.id === itemId)).toBe(false);
	});
});
