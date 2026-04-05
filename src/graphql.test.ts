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

		const single = result.body;
		expect(single.singleResult.errors).toBeUndefined();
		const dataLists = single.singleResult.data?.lists as { id: string; name: string }[];
		expect(dataLists).toBeDefined();
		expect(Array.isArray(dataLists)).toBe(true);
		expect(dataLists.length).toBeGreaterThan(0);
		dataLists.forEach((list) => {
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
		const listsData = (listsResult.body.singleResult.data as { lists: { id: string; name: string }[] })?.lists;
		const listById = listsData[0];

		const result = await server.executeOperation({
			query: `
				query GetList($id: ID!) {
					list(id: $id) {
						id
						name
					}
				}
			`,
			variables: { id: listById.id },
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		const single = result.body;
		expect(single.singleResult.errors).toBeUndefined();
		expect(single.singleResult.data?.list).toEqual({
			id: listById.id,
			name: listById.name,
		});
	});

	it('Should return list with items when requested.', async () => {
		const listsResult = await server.executeOperation({
			query: `query { lists { id name items { id name } } }`,
		});
		if (listsResult.body.kind !== 'single') throw new Error('Expected single result');
		const listsData = (listsResult.body.singleResult.data as {
			lists: { id: string; name: string; items: { id: string; name: string }[] }[];
		})?.lists;
		const listWithItems = listsData[1];

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
			variables: { id: listWithItems.id },
		});

		if (result.body.kind !== 'single') {
			throw new Error(`Expected single result, got ${result.body.kind}`);
		}

		const single = result.body;
		const list = single.singleResult.data?.list as { id: string; name: string; items: { id: string; name: string }[] };

		expect(single.singleResult.errors).toBeUndefined();
		expect(list.id).toBe(listWithItems.id);
		expect(list.name).toBe(listWithItems.name);
		expect(Array.isArray(list.items)).toBe(true);
		expect(list.items.length).toBe(listWithItems.items.length);
		expect(list.items[0]).toHaveProperty('id');
		expect(list.items[0]).toHaveProperty('name');
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

		const single = result.body;
		expect(single.singleResult.data?.createNewList).toBeUndefined();
		expect(single.singleResult.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
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

		const single = result.body;
		expect(single.singleResult.errors).toBeUndefined();
		const created = single.singleResult.data?.createNewList as {
			id: string;
			name: string;
			type: string;
			items: unknown[];
		};
		expect(created).toMatchObject({
			name: input.name,
			type: input.type,
		});
		expect(created.items).toEqual([]);
		expect(typeof created.id).toBe('string');

		const listsAfter = await server.executeOperation({
			query: `query { lists { id name } }`,
		});

		if (listsAfter.body.kind !== 'single') throw new Error('Expected single result');
		const allLists = (listsAfter.body.singleResult.data as { lists: { id: string; name: string }[] })?.lists;

		expect(allLists.some((l) => l.id === created.id && l.name === created.name)).toBe(true);

		const byIdResult = await server.executeOperation({
			query: `
				query GetCreated($id: ID!) {
					list(id: $id) {
						id
						name
						type
					}
				}
			`,
			variables: { id: created.id },
		});

		if (byIdResult.body.kind !== 'single') throw new Error('Expected single result');
		expect(byIdResult.body.singleResult.errors).toBeUndefined();
		expect(byIdResult.body.singleResult.data?.list).toEqual({
			id: created.id,
			name: input.name,
			type: input.type,
		});
	});
});
