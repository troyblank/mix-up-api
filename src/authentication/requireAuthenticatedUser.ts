import { GraphQLError } from 'graphql';
import type { CognitoUser, GraphQLContext } from './graphqlContext.ts';

export const requireAuthenticatedUser = (context: GraphQLContext): CognitoUser => {
	if (!context.cognito) {
		throw new GraphQLError('Not authenticated', {
			extensions: { code: 'UNAUTHENTICATED' },
		});
	}
	return context.cognito;
};
