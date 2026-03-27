import type { CreateListInput, List } from '../generated/types.ts';

export const createNewList = (input: CreateListInput): List => {
	const { name, type } = input;
	return {
		id: new Date().getTime().toString(),
		name,
		type,
		items: [],
	};
};
