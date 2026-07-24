import Chance from 'chance';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { resetMockPgRows } from './database/__mocks__/pg.ts';
import * as publishListItemDeletedModule from './kafka/publishListItemDeleted.ts';

const chance = new Chance();

describe('GraphQL API', () => {
	let server: Awaited<typeof import('./graphql.js')>['server'];

	const authenticatedContext = () => ({ cognito: { sub: chance.guid() } });

	async function createListViaApi(input: {
		name: string;
		type: 'pick' | 'list';
	}): Promise<{ id: string; name: string; type: string }> {
		const result = await server.executeOperation(
			{
				query: `
					mutation CreateNewList($input: CreateListInput!) {
						createNewList(input: $input) {
							id
							name
							type
						}
					}
				`,
				variables: { input },
			},
			{ contextValue: authenticatedContext() },
		);

		if (result.body.kind !== 'single') throw new Error('Expected single result');
		expect(result.body.singleResult.errors).toBeUndefined();
		const created = result.body.singleResult.data?.createNewList as {
			id: string;
			name: string;
			type: string;
		};
		return created;
	}

	async function insertListItemViaApi(
		listId: string,
		name: string,
	): Promise<{ id: string; name: string }> {
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
				variables: { input: { listId, name } },
			},
			{ contextValue: authenticatedContext() },
		);

		if (result.body.kind !== 'single') throw new Error('Expected single result');
		expect(result.body.singleResult.errors).toBeUndefined();
		return result.body.singleResult.data?.insertListItem as { id: string; name: string };
	}

	beforeAll(async () => {
		process.env.DATABASE_URL = 'postgresql://test';
		jest
			.spyOn(publishListItemDeletedModule, 'publishListItemDeleted')
			.mockImplementation(async () => {
				return undefined;
			});
		jest
			.spyOn(publishListItemDeletedModule, 'publishListItemsDeleted')
			.mockImplementation(async () => {
				return undefined;
			});
		const graphql = await import('./graphql.js');
		server = graphql.server;
		await server.start();
	});

	afterAll(async () => {
		delete process.env.DATABASE_URL;
		jest.mocked(publishListItemDeletedModule.publishListItemDeleted).mockRestore();
		jest.mocked(publishListItemDeletedModule.publishListItemsDeleted).mockRestore();
		await server.stop();
	});

	beforeEach(() => {
		resetMockPgRows();
		jest.mocked(publishListItemDeletedModule.publishListItemDeleted).mockClear();
		jest.mocked(publishListItemDeletedModule.publishListItemsDeleted).mockClear();
	});

	it('Should return all lists with id and name.', async () => {
		const listName = chance.sentence({ words: 3 });
		await createListViaApi({ name: listName, type: 'pick' });

		const result = await server.executeOperation(
			{
				query: `
				query {
					lists {
						id
						name
					}
				}
			`,
			},
			{ contextValue: authenticatedContext() },
		);

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
		expect(listsFromGraphQLQueryResponse.length).toBeGreaterThanOrEqual(1);
		expect(listsFromGraphQLQueryResponse.some((list) => list.name === listName)).toBe(true);
		listsFromGraphQLQueryResponse.forEach((list) => {
			expect(list).toHaveProperty('id');
			expect(list).toHaveProperty('name');
			expect(typeof list.id).toBe('string');
			expect(typeof list.name).toBe('string');
		});
	});

	it('Returns null when no list matches the id.', async () => {
		const result = await server.executeOperation(
			{
				query: `
				query {
					list(id: "no-such-list-id") {
						id
					}
				}
			`,
			},
			{ contextValue: authenticatedContext() },
		);

		if (result.body.kind !== 'single') throw new Error('Expected single result');
		expect(result.body.singleResult.errors).toBeUndefined();
		expect(result.body.singleResult.data?.list).toBeNull();
	});

	it('Should return a single list by id.', async () => {
		const listName = chance.sentence({ words: 3 });
		const created = await createListViaApi({ name: listName, type: 'list' });

		const result = await server.executeOperation(
			{
				query: `
				query GetList($id: ID!) {
					list(id: $id) {
						id
						name
					}
				}
			`,
				variables: { id: created.id },
			},
			{ contextValue: authenticatedContext() },
		);

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		const singleResponseBody = result.body;
		expect(singleResponseBody.singleResult.errors).toBeUndefined();
		expect(singleResponseBody.singleResult.data?.list).toEqual({
			id: created.id,
			name: listName,
		});
	});

	it('Should return list with items when requested.', async () => {
		const listInput = {
			name: chance.sentence({ words: 3 }),
			type: chance.pickone(['pick', 'list'] as const),
		};
		const created = await createListViaApi(listInput);
		const itemName = chance.sentence({ words: 2 });
		const insertedItem = await insertListItemViaApi(created.id, itemName);

		const result = await server.executeOperation(
			{
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
				variables: { id: created.id },
			},
			{ contextValue: authenticatedContext() },
		);

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
		expect(listFromListFieldQuery.id).toBe(created.id);
		expect(listFromListFieldQuery.name).toBe(created.name);
		expect(Array.isArray(listFromListFieldQuery.items)).toBe(true);
		expect(listFromListFieldQuery.items).toHaveLength(1);
		expect(listFromListFieldQuery.items[0]).toEqual({
			id: insertedItem.id,
			name: itemName,
		});
	});

	it('Should reject lists when authentication is not present on the context.', async () => {
		const result = await server.executeOperation({
			query: `query { lists { id } }`,
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		expect(result.body.singleResult.data?.lists).toBeUndefined();
		expect(result.body.singleResult.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
	});

	it('Should reject list when authentication is not present on the context.', async () => {
		const result = await server.executeOperation({
			query: `
				query {
					list(id: "placeholder-list-identifier") {
						id
					}
				}
			`,
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		expect(result.body.singleResult.data?.list).toBeNull();
		expect(result.body.singleResult.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
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

		const listsAfter = await server.executeOperation(
			{
				query: `query { lists { id name } }`,
			},
			{ contextValue: authenticatedContext() },
		);

		if (listsAfter.body.kind !== 'single') throw new Error('Expected single result');
		const allLists = (listsAfter.body.singleResult.data as { lists: { id: string; name: string }[] })?.lists;

		expect(
			allLists.some(
				(list) => list.id === createdList.id && list.name === createdList.name,
			),
		).toBe(true);

		const fetchListByIdentifierResult = await server.executeOperation(
			{
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
			},
			{ contextValue: authenticatedContext() },
		);

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

		const listResult = await server.executeOperation(
			{
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
			},
			{ contextValue: authenticatedContext() },
		);

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

		const listResult = await server.executeOperation(
			{
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
			},
			{ contextValue: authenticatedContext() },
		);

		if (listResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(listResult.body.singleResult.errors).toBeUndefined();
		const items = (listResult.body.singleResult.data?.list as { items: { id: string }[] }).items;
		expect(items.some((item) => item.id === itemId)).toBe(false);
	});

	it('Should not publish a list-item delete event when the list is not a pick list.', async () => {
		const listId = (
			await createListViaApi({
				name: chance.sentence({ words: 3 }),
				type: 'list',
			})
		).id;
		const { id: itemId } = await insertListItemViaApi(listId, chance.sentence({ words: 2 }));

		const deleteResult = await server.executeOperation(
			{
				query: `
					mutation DeleteItem($input: DeleteListItemInput!) {
						deleteListItem(input: $input)
					}
				`,
				variables: { input: { itemId } },
			},
			{ contextValue: authenticatedContext() },
		);

		if (deleteResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(deleteResult.body.singleResult.errors).toBeUndefined();
		expect(deleteResult.body.singleResult.data?.deleteListItem).toBe(true);
		expect(publishListItemDeletedModule.publishListItemDeleted).not.toHaveBeenCalled();
	});

	it('Publishes a delete event when a pick list item is deleted.', async () => {
		const listId = (
			await createListViaApi({
				name: chance.sentence({ words: 3 }),
				type: 'pick',
			})
		).id;
		const { id: itemId } = await insertListItemViaApi(listId, chance.sentence({ words: 2 }));

		const deleteResult = await server.executeOperation(
			{
				query: `
					mutation DeleteItem($input: DeleteListItemInput!) {
						deleteListItem(input: $input)
					}
				`,
				variables: { input: { itemId } },
			},
			{ contextValue: authenticatedContext() },
		);

		if (deleteResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(deleteResult.body.singleResult.errors).toBeUndefined();
		expect(deleteResult.body.singleResult.data?.deleteListItem).toBe(true);
		expect(publishListItemDeletedModule.publishListItemDeleted).toHaveBeenCalledTimes(1);
		expect(publishListItemDeletedModule.publishListItemDeleted).toHaveBeenCalledWith(
			expect.objectContaining({
				itemId,
				listId,
				listType: 'pick',
			}),
		);
	});

	it('Should reject deleteListItems when authentication is not present on the context.', async () => {
		const result = await server.executeOperation({
			query: `
				mutation DeleteItems($input: DeleteListItemsInput!) {
					deleteListItems(input: $input)
				}
			`,
			variables: {
				input: { itemIds: ['placeholder-item-identifier'] },
			},
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		expect(result.body.singleResult.data?.deleteListItems).toBeUndefined();
		expect(result.body.singleResult.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
	});

	it('Should return NOT_FOUND when deleteListItems targets items that do not exist.', async () => {
		const result = await server.executeOperation(
			{
				query: `
					mutation DeleteItems($input: DeleteListItemsInput!) {
						deleteListItems(input: $input)
					}
				`,
				variables: {
					input: { itemIds: [chance.guid(), chance.guid()] },
				},
			},
			{ contextValue: authenticatedContext() },
		);

		if (result.body.kind !== 'single') throw new Error('Expected single result');
		expect(result.body.singleResult.data?.deleteListItems).toBeUndefined();
		expect(result.body.singleResult.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
	});

	it('Should return NOT_FOUND when deleteListItems targets only some existing items.', async () => {
		const listId = (
			await createListViaApi({
				name: chance.sentence({ words: 3 }),
				type: 'list',
			})
		).id;
		const existingItem = await insertListItemViaApi(listId, chance.sentence({ words: 2 }));

		const result = await server.executeOperation(
			{
				query: `
					mutation DeleteItems($input: DeleteListItemsInput!) {
						deleteListItems(input: $input)
					}
				`,
				variables: {
					input: { itemIds: [existingItem.id, chance.guid()] },
				},
			},
			{ contextValue: authenticatedContext() },
		);

		if (result.body.kind !== 'single') throw new Error('Expected single result');
		expect(result.body.singleResult.data?.deleteListItems).toBeUndefined();
		expect(result.body.singleResult.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

		const listResult = await server.executeOperation(
			{
				query: `
				query List($id: ID!) {
					list(id: $id) {
						items {
							id
						}
					}
				}
			`,
				variables: { id: listId },
			},
			{ contextValue: authenticatedContext() },
		);

		if (listResult.body.kind !== 'single') throw new Error('Expected single result');
		const items = (listResult.body.singleResult.data?.list as { items: { id: string }[] })
			.items;
		expect(items).toEqual([{ id: existingItem.id }]);
	});

	it('Should remove multiple list items via deleteListItems and omit them from the list query.', async () => {
		const listId = (
			await createListViaApi({
				name: chance.sentence({ words: 3 }),
				type: 'list',
			})
		).id;
		const firstItem = await insertListItemViaApi(listId, chance.sentence({ words: 2 }));
		await new Promise((resolve) => setTimeout(resolve, 2));
		const secondItem = await insertListItemViaApi(listId, chance.sentence({ words: 2 }));
		await new Promise((resolve) => setTimeout(resolve, 2));
		const thirdItem = await insertListItemViaApi(listId, chance.sentence({ words: 2 }));

		const deleteResult = await server.executeOperation(
			{
				query: `
					mutation DeleteItems($input: DeleteListItemsInput!) {
						deleteListItems(input: $input)
					}
				`,
				variables: {
					input: { itemIds: [firstItem.id, thirdItem.id] },
				},
			},
			{ contextValue: authenticatedContext() },
		);

		if (deleteResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(deleteResult.body.singleResult.errors).toBeUndefined();
		expect(deleteResult.body.singleResult.data?.deleteListItems).toBe(2);

		const listResult = await server.executeOperation(
			{
				query: `
				query List($id: ID!) {
					list(id: $id) {
						items {
							id
						}
					}
				}
			`,
				variables: { id: listId },
			},
			{ contextValue: authenticatedContext() },
		);

		if (listResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(listResult.body.singleResult.errors).toBeUndefined();
		const items = (listResult.body.singleResult.data?.list as { items: { id: string }[] })
			.items;
		expect(items).toEqual([{ id: secondItem.id }]);
	});

	it('Should return zero when deleteListItems is called with an empty itemIds array.', async () => {
		const result = await server.executeOperation(
			{
				query: `
					mutation DeleteItems($input: DeleteListItemsInput!) {
						deleteListItems(input: $input)
					}
				`,
				variables: {
					input: { itemIds: [] },
				},
			},
			{ contextValue: authenticatedContext() },
		);

		if (result.body.kind !== 'single') throw new Error('Expected single result');
		expect(result.body.singleResult.errors).toBeUndefined();
		expect(result.body.singleResult.data?.deleteListItems).toBe(0);
	});

	it('Should reject deleteList when authentication is not present on the context.', async () => {
		const result = await server.executeOperation({
			query: `
				mutation DeleteList($input: DeleteListInput!) {
					deleteList(input: $input)
				}
			`,
			variables: {
				input: { listId: 'placeholder-list-identifier' },
			},
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		expect(result.body.singleResult.data?.deleteList).toBeUndefined();
		expect(result.body.singleResult.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
	});

	it('Should return NOT_FOUND when deleteList targets a list that does not exist.', async () => {
		const result = await server.executeOperation(
			{
				query: `
					mutation DeleteList($input: DeleteListInput!) {
						deleteList(input: $input)
					}
				`,
				variables: {
					input: { listId: chance.guid() },
				},
			},
			{ contextValue: authenticatedContext() },
		);

		if (result.body.kind !== 'single') throw new Error('Expected single result');
		expect(result.body.singleResult.data?.deleteList).toBeUndefined();
		expect(result.body.singleResult.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
	});

	it('Should remove a list via deleteList and omit it from the lists query.', async () => {
		const created = await createListViaApi({
			name: chance.sentence({ words: 3 }),
			type: 'list',
		});
		await insertListItemViaApi(created.id, chance.sentence({ words: 2 }));
		await insertListItemViaApi(created.id, chance.sentence({ words: 2 }));

		const deleteResult = await server.executeOperation(
			{
				query: `
					mutation DeleteList($input: DeleteListInput!) {
						deleteList(input: $input)
					}
				`,
				variables: { input: { listId: created.id } },
			},
			{ contextValue: authenticatedContext() },
		);

		if (deleteResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(deleteResult.body.singleResult.errors).toBeUndefined();
		expect(deleteResult.body.singleResult.data?.deleteList).toBe(true);

		const listResult = await server.executeOperation(
			{
				query: `
				query GetList($id: ID!) {
					list(id: $id) {
						id
					}
				}
			`,
				variables: { id: created.id },
			},
			{ contextValue: authenticatedContext() },
		);

		if (listResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(listResult.body.singleResult.errors).toBeUndefined();
		expect(listResult.body.singleResult.data?.list).toBeNull();

		const listsResult = await server.executeOperation(
			{
				query: `query { lists { id } }`,
			},
			{ contextValue: authenticatedContext() },
		);

		if (listsResult.body.kind !== 'single') throw new Error('Expected single result');
		const lists = (listsResult.body.singleResult.data as { lists: { id: string }[] }).lists;
		expect(lists.some((list) => list.id === created.id)).toBe(false);
	});

	it('Should not publish list-item delete events when a non-pick list is deleted.', async () => {
		const created = await createListViaApi({
			name: chance.sentence({ words: 3 }),
			type: 'list',
		});
		await insertListItemViaApi(created.id, chance.sentence({ words: 2 }));

		const deleteResult = await server.executeOperation(
			{
				query: `
					mutation DeleteList($input: DeleteListInput!) {
						deleteList(input: $input)
					}
				`,
				variables: { input: { listId: created.id } },
			},
			{ contextValue: authenticatedContext() },
		);

		if (deleteResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(deleteResult.body.singleResult.errors).toBeUndefined();
		expect(deleteResult.body.singleResult.data?.deleteList).toBe(true);
		expect(publishListItemDeletedModule.publishListItemsDeleted).not.toHaveBeenCalled();
	});

	it('Publishes delete events in one batch when a pick list is deleted.', async () => {
		const created = await createListViaApi({
			name: chance.sentence({ words: 3 }),
			type: 'pick',
		});
		const firstItem = await insertListItemViaApi(created.id, chance.sentence({ words: 2 }));
		const secondItem = await insertListItemViaApi(created.id, chance.sentence({ words: 2 }));

		const deleteResult = await server.executeOperation(
			{
				query: `
					mutation DeleteList($input: DeleteListInput!) {
						deleteList(input: $input)
					}
				`,
				variables: { input: { listId: created.id } },
			},
			{ contextValue: authenticatedContext() },
		);

		if (deleteResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(deleteResult.body.singleResult.errors).toBeUndefined();
		expect(deleteResult.body.singleResult.data?.deleteList).toBe(true);
		expect(publishListItemDeletedModule.publishListItemsDeleted).toHaveBeenCalledTimes(1);
		expect(publishListItemDeletedModule.publishListItemsDeleted).toHaveBeenCalledWith([
			expect.objectContaining({
				itemId: firstItem.id,
				listId: created.id,
				listType: 'pick',
			}),
			expect.objectContaining({
				itemId: secondItem.id,
				listId: created.id,
				listType: 'pick',
			}),
		]);
	});
});
