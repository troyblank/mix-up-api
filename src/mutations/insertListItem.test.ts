import Chance from 'chance';
import { describe, expect, it } from '@jest/globals';
import { insertListItem } from './insertListItem.js';

const chance = new Chance();

describe('Insert List Item Mutation', () => {
	it('Returns a new list item with the given name and a string id.', () => {
		const name = chance.sentence({ words: 2 });
		const item = insertListItem({ listId: chance.guid(), name });

		expect(item.name).toBe(name);
		expect(typeof item.id).toBe('string');
	});
});
