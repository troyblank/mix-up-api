import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { COGNITO_CLIENT_ID, COGNITO_USER_POOL_ID } from '../../config.ts';

const mockVerify = jest.fn() as jest.MockedFunction<(token: string) => Promise<{ sub?: unknown }>>;
const mockVerifier = { verify: mockVerify };
const mockCreate = jest.fn(() => mockVerifier) as jest.MockedFunction<
	(config: unknown) => typeof mockVerifier
>;

jest.mock('aws-jwt-verify', () => ({
	CognitoJwtVerifier: {
		create: (config: unknown) => mockCreate(config),
	},
}));

describe('Parse Bearer Token.', () => {
	beforeEach(() => {
		jest.resetModules();
	});

	it('Gets the JWT from a normal Bearer line.', async () => {
		const { parseBearerToken } = await import('./graphqlContext.ts');
		expect(parseBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
	});

	it('Still works when Bearer is spelled in lowercase.', async () => {
		const { parseBearerToken } = await import('./graphqlContext.ts');
		expect(parseBearerToken('bearer secret-token')).toBe('secret-token');
	});

	it('Gets nothing when the header is missing, blank, or not a Bearer line.', async () => {
		const { parseBearerToken } = await import('./graphqlContext.ts');
		expect(parseBearerToken(undefined)).toBeNull();
		expect(parseBearerToken('')).toBeNull();
		expect(parseBearerToken('Basic x')).toBeNull();
	});
});

describe('Building the GraphQL context from the Authorization header', () => {
	beforeEach(() => {
		jest.resetModules();

		mockVerify.mockReset();
		mockCreate.mockReset();
		mockCreate.mockImplementation(() => mockVerifier);

		mockVerify.mockResolvedValue({ sub: 'user-sub' });
	});

	it('Does not try to verify with Cognito when there is no token.', async () => {
		const { buildGraphqlContextFromAuthHeader } = await import('./graphqlContext.ts');

		expect(await buildGraphqlContextFromAuthHeader(undefined)).toEqual({});
		expect(await buildGraphqlContextFromAuthHeader('')).toEqual({});
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it('Sets up the Cognito checker once and reuses it for the next signed-in request.', async () => {
		const { buildGraphqlContextFromAuthHeader } = await import('./graphqlContext.ts');
		const first = await buildGraphqlContextFromAuthHeader('Bearer token.one');

		expect(first).toEqual({ cognito: { sub: 'user-sub' } });
		expect(mockCreate).toHaveBeenCalledTimes(1);
		expect(mockCreate).toHaveBeenCalledWith({
			userPoolId: COGNITO_USER_POOL_ID,
			tokenUse: 'id',
			clientId: COGNITO_CLIENT_ID,
		});
		expect(mockVerify).toHaveBeenNthCalledWith(1, 'token.one');

		mockVerify.mockResolvedValue({ sub: 'second-user' });
		
		const second = await buildGraphqlContextFromAuthHeader('Bearer token.two');

		expect(second).toEqual({ cognito: { sub: 'second-user' } });
		expect(mockCreate).toHaveBeenCalledTimes(1);
		expect(mockVerify).toHaveBeenNthCalledWith(2, 'token.two');
	});

	it('Treats the caller as signed out when the token fails verification.', async () => {
		mockVerify.mockRejectedValue(new Error('invalid token'));
		const { buildGraphqlContextFromAuthHeader } = await import('./graphqlContext.ts');

		expect(await buildGraphqlContextFromAuthHeader('Bearer bad')).toEqual({});
	});

	it('Treats the caller as signed out when the user id inside the token is missing or not real text.', async () => {
		mockVerify.mockResolvedValue({ sub: '' });
		const { buildGraphqlContextFromAuthHeader } = await import('./graphqlContext.ts');
		
		expect(await buildGraphqlContextFromAuthHeader('Bearer x')).toEqual({});

		jest.resetModules();
		mockVerify.mockReset();
		mockCreate.mockReset();
		mockCreate.mockImplementation(() => mockVerifier);
		mockVerify.mockResolvedValue({ sub: 42 } as never);

		const { buildGraphqlContextFromAuthHeader: buildAgain } = await import('./graphqlContext.ts');

		expect(await buildAgain('Bearer y')).toEqual({});
	});
});
