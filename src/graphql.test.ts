import { server, lists } from './graphql.js';

describe('GraphQL API', () => {
	beforeAll(() => server.start());

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
		expect(single.singleResult.data?.lists).toHaveLength(lists.length);
		expect(single.singleResult.data?.lists).toEqual(
			expect.arrayContaining(lists.map((list) => ({ id: list.id, name: list.name }))),
		);
	});

	it('Should return a single list by id.', async () => {
		const listById = lists[0];
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
		const listWithItems = lists[1];
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
});
