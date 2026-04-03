import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApolloServer } from '@apollo/server';
import {
	addList,
	getLists,
	getListsById,
	INITIAL_LISTS,
} from './database/index.ts';
import type { CreateListInput } from './generated/types.ts';
import { createNewList } from './mutations/index.ts';

type ID = string;

const typeDefs = readFileSync(join(process.cwd(), 'src', 'schema.graphql'), 'utf8');

const resolvers = {
	Mutation: {
		createNewList: async (_: unknown, { input }: { input: CreateListInput }) => {
			const newList = createNewList(input);
			await addList(newList);

			return newList;
		},
	},
	Query: {
		lists: async () => {
			return getLists();
		},
		list: async (_: unknown, { id }: { id: ID }) => {
			const fromSeed = INITIAL_LISTS.find((list) => list.id === id);
			if (fromSeed) return fromSeed;
			return getListsById(id);
		},
	},
};

export const server = new ApolloServer({ typeDefs, resolvers });
