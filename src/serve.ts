import 'dotenv/config';

import { startStandaloneServer } from '@apollo/server/standalone';
import { server } from './graphql.ts';

startStandaloneServer(server).then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
});
