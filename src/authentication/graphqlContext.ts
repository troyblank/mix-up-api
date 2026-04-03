import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { COGNITO_CLIENT_ID, COGNITO_USER_POOL_ID } from '../../config.ts';

export type CognitoUser = { sub: string };

export type GraphQLContext = {
	cognito?: CognitoUser;
};

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

const getVerifier = () => {
	if (!verifier) {
		verifier = CognitoJwtVerifier.create({
			userPoolId: COGNITO_USER_POOL_ID,
			tokenUse: 'id',
			clientId: COGNITO_CLIENT_ID,
		});
	}
	return verifier;
};

export const parseBearerToken = (authorizationHeader: string | undefined): string | null => {
	if (!authorizationHeader) return null;
	const m = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
	return m?.[1]?.trim() ?? null;
};

export const buildGraphqlContextFromAuthHeader = async (
	authorizationHeader: string | undefined,
): Promise<GraphQLContext> => {
	const token = parseBearerToken(authorizationHeader);
	if (!token) return {};

	try {
		const payload = await getVerifier().verify(token);
		const sub = payload.sub;

		if (typeof sub !== 'string' || sub.length === 0) return {};

		return { cognito: { sub } };
	} catch {
		return {};
	}
}
