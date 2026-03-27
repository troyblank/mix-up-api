import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApolloServer } from '@apollo/server';
import { comedies, cookBooks, movies, shows, middara } from './data/index.ts';
import type { CreateListInput, List } from './generated/types.ts';
import { createNewList } from './mutations/index.ts';

type ID = string;

const typeDefs = readFileSync(join(process.cwd(), 'src', 'schema.graphql'), 'utf8');

let lists: List[] = [
    {
        id: '1',
        name: 'TV Shows',
        type: 'pick',
        items: shows,
    },
    {
        id: '5',
        name: 'Comedies',
        type: 'pick',
        items: comedies,
    },
    {
        id: '2',
        name: 'Movies',
        type: 'pick',
        items: movies,
    },
    {
        id: '4',
        name: 'Cook Books',
        type: 'pick',
        items: cookBooks,
    },
    {
        id: '3',
        name: 'Middara',
        type: 'list',
        items: middara,
    },
];

const resolvers = {
    Mutation: {
        createNewList: (_: unknown, { input }: { input: CreateListInput }) => {
            const newList = createNewList(input);
            lists = [...lists, newList];

            return newList;
        },
    },
    Query: {
        lists: () => lists,
        list: (_: unknown, { id }: { id: ID }) => lists.find((list) => list.id === id),
    },
};

export const server = new ApolloServer({ typeDefs, resolvers });
