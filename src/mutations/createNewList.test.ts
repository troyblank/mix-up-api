import Chance from 'chance';
import { createNewList } from './createNewList.js';

const chance = new Chance();

describe('Create New List Mutation', () => {
	it('Returns a new list with empty items and the given name and type.', () => {
		const newName = chance.sentence({ words: 3 });
		const newType = chance.pickone(['pick', 'list'] as const);
		const input = { name: newName, type: newType };

		const list = createNewList(input);

		expect(list.name).toBe(newName);
		expect(list.type).toBe(newType);
		expect(list.items).toEqual([]);
		expect(typeof list.id).toBe('string');
	});
});
