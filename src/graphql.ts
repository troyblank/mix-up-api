import { ApolloServer } from '@apollo/server';
import { movies, shows } from './data/index.ts';

type ID = string;

const typeDefs = `
    type ListItem {
        id: ID!
        name: String!
    }
    type List {
        id: ID!
        name: String!
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
        items: shows,
    },
    {
        id: '2',
        name: 'Movies',
        items: movies,
    },
];

const resolvers = {
    Query: {
        lists: () => lists,
        list: (_: unknown, { id }: { id: ID }) => lists.find((list) => list.id === id),
    },
};

export const server = new ApolloServer({ typeDefs, resolvers });
