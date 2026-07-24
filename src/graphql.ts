import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApolloServer } from '@apollo/server';
import { GraphQLError } from 'graphql';
import { requireAuthenticatedUser, type GraphQLContext } from './authentication/index.ts';
import {
	addList,
	appendListItem,
	deleteList,
	deleteListItem,
	deleteListItems,
	getLists,
	getListsById,
} from './database/index.ts';
import type {
	CreateListInput,
	DeleteListInput,
	DeleteListItemInput,
	DeleteListItemsInput,
	InsertListItemInput,
} from './generated/types.ts';
import { createNewList, insertListItem } from './mutations/index.ts';
import {
	publishListItemDeleted,
	publishListItemsDeleted,
} from './kafka/publishListItemDeleted.ts';

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
			if (deleted.listType === 'pick') {
				await publishListItemDeleted(deleted);
			}
			return true;
		},
		deleteListItems: async (
			_: unknown,
			{ input }: { input: DeleteListItemsInput },
			context: GraphQLContext,
		) => {
			requireAuthenticatedUser(context);
			if (input.itemIds.length === 0) {
				return 0;
			}
			const requestedCount = new Set(input.itemIds).size;
			const deleted = await deleteListItems(input.itemIds);
			if (deleted.length !== requestedCount) {
				throw new GraphQLError('List items not found', {
					extensions: { code: 'NOT_FOUND' },
				});
			}
			await publishListItemsDeleted(deleted);
			return deleted.length;
		},
		deleteList: async (
			_: unknown,
			{ input }: { input: DeleteListInput },
			context: GraphQLContext,
		) => {
			requireAuthenticatedUser(context);
			const deleted = await deleteList(input.listId);
			if (!deleted) {
				throw new GraphQLError('List not found', {
					extensions: { code: 'NOT_FOUND' },
				});
			}
			if (deleted.listType === 'pick') {
				await publishListItemsDeleted(deleted.items);
			}
			return true;
		},
	},
	Query: {
		lists: async (_: unknown, __: unknown, context: GraphQLContext) => {
			requireAuthenticatedUser(context);
			return getLists();
		},
		list: async (_: unknown, { id }: { id: ID }, context: GraphQLContext) => {
			requireAuthenticatedUser(context);
			return getListsById(id);
		},
	},
};

export const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
