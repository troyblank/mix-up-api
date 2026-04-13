import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApolloServer } from '@apollo/server';
import { GraphQLError } from 'graphql';
import { requireAuthenticatedUser, type GraphQLContext } from './authentication';
import {
	addList,
	appendListItem,
	deleteListItem,
	getLists,
	getListsById,
	INITIAL_LISTS,
} from './database/index.ts';
import type { CreateListInput, DeleteListItemInput, InsertListItemInput } from './generated/types.ts';
import { createNewList, insertListItem } from './mutations/index.ts';

type ID = string;

const typeDefs = readFileSync(join(process.cwd(), 'src', 'schema.graphql'), 'utf8');

const resolvers = {
	Mutation: {
		createNewList: async (
			_: unknown,
			{ input }: { input: CreateListInput },
			context: GraphQLContext,
		) => {
			requireAuthenticatedUser(context);
			const newList = createNewList(input);
			await addList(newList);

			return newList;
		},
		insertListItem: async (
			_: unknown,
			{ input }: { input: InsertListItemInput },
			context: GraphQLContext,
		) => {
			requireAuthenticatedUser(context);
			const item = insertListItem(input);
			const updated = await appendListItem(input.listId, item);
			if (!updated) {
				throw new GraphQLError('List not found', {
					extensions: { code: 'NOT_FOUND' },
				});
			}

			return item;
		},
		deleteListItem: async (
			_: unknown,
			{ input }: { input: DeleteListItemInput },
			context: GraphQLContext,
		) => {
			requireAuthenticatedUser(context);
			const deleted = await deleteListItem(input.itemId);
			if (!deleted) {
				throw new GraphQLError('List item not found', {
					extensions: { code: 'NOT_FOUND' },
				});
			}
			return true;
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

export const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
