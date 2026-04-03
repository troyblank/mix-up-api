import 'dotenv/config';

import { startStandaloneServer } from '@apollo/server/standalone';
import { buildGraphqlContextFromAuthHeader } from './authentication/graphqlContext.ts';
import { server } from './graphql.ts';

startStandaloneServer(server, {
	context: async ({ req }) => {
		const raw = req.headers.authorization;
		const header = Array.isArray(raw) ? raw[0] : raw;
		return buildGraphqlContextFromAuthHeader(header);
	},
}).then(({ url }) => {
	console.log(`🚀 Server ready at ${url}`);
});
