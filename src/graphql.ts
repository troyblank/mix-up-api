import { ApolloServer } from '@apollo/server';
import { movies, shows, middara } from './data/index.ts';

type ID = string;

const typeDefs = `
    type ListItem {
        id: ID!
        name: String!
    }
    enum ListType {
        pick
        list
    }
    type List {
        id: ID!
        name: String!
        type: ListType!
        items: [ListItem]!
    }
    type Query {
        lists: [List]!
        list(id: ID!): List
    }
`;

export const lists = [
    {
        id: '1',
        name: 'TV Shows',
        type: 'pick',
        items: shows,
    },
    {
        id: '2',
        name: 'Movies',
        type: 'pick',
        items: movies,
    },
    {
        id: '3',
        name: 'Middara',
        type: 'list',
        items: middara,
    },
];

const resolvers = {
    Query: {
        lists: () => lists,
        list: (_: unknown, { id }: { id: ID }) => lists.find((list) => list.id === id),
    },
};

export const server = new ApolloServer({ typeDefs, resolvers });
