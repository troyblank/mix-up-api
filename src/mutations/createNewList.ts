import { randomUUID } from 'node:crypto';
import type { CreateListInput, List } from '../generated/types.ts';

export const createNewList = (input: CreateListInput): List => {
	const { name, type, isPrivate } = input;
	return {
		id: randomUUID(),
		name,
		type,
		isPrivate: isPrivate ?? false,
		items: [],
	};
};
