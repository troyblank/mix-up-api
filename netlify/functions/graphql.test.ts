import Chance from 'chance';
import { createHandler, type GraphqlHandlerDeps } from './graphql.js';

const chance = new Chance();

describe('Netlify GraphQL Handler', () => {
	it('Should call ensureServerStarted and return the server response.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			status: 200,
			headers: [['content-type', 'application/json'] as [string, string]],
			body: { kind: 'complete' as const, string: '{"data":{"lists":[]}}' },
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});

		const result = await handler({
			httpMethod: 'POST',
			body: JSON.stringify({ query: '{ lists { id } }' }),
		});

		expect(mockEnsureServerStarted).toHaveBeenCalledTimes(1);
		expect(mockExecute).toHaveBeenCalledTimes(1);
		expect(result.statusCode).toBe(200);
		expect(result.body).toBe('{"data":{"lists":[]}}');
		expect(result.headers['Content-Type']).toBe('application/json');
		expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
	});

	it('Should use 200 when response status is undefined.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			headers: [],
			body: { kind: 'complete' as const, string: '{}' },
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});

		const result = await handler({ httpMethod: 'GET' });

		expect(result.statusCode).toBe(200);
	});

	it('Should include CORS headers in the response.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			status: 200,
			headers: [],
			body: { kind: 'complete' as const, string: '{}' },
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});

		const result = await handler({ httpMethod: 'GET' });

		expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
		expect(result.headers['Access-Control-Allow-Headers']).toBe(
			'Content-Type, Authorization',
		);
	});

	it('Should use GET when httpMethod is missing.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			status: 200,
			headers: [],
			body: { kind: 'complete' as const, string: '{}' },
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});

		await handler({});

		const { httpGraphQLRequest } = mockExecute.mock.calls[0][0];
		expect(httpGraphQLRequest.method).toBe('GET');
	});

	it('Should pass event body and method to the server.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			status: 200,
			headers: [],
			body: { kind: 'complete' as const, string: '{}' },
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});

		await handler({
			httpMethod: 'POST',
			body: '{"query":"{ list(id: \\"1\\") { name } }"}',
			rawQuery: 'foo=bar',
		});

		expect(mockExecute).toHaveBeenCalledWith(
			expect.objectContaining({
				httpGraphQLRequest: expect.objectContaining({
					method: 'POST',
					search: '?foo=bar',
				}),
			}),
		);
		const { httpGraphQLRequest } = mockExecute.mock.calls[0][0];
		expect(httpGraphQLRequest.body).toEqual({ query: '{ list(id: "1") { name } }' });
	});

	it('Should pass raw body when JSON.parse throws.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			status: 200,
			headers: [],
			body: { kind: 'complete' as const, string: '{}' },
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});
		const rawBody = 'not valid json';

		await handler({ httpMethod: 'POST', body: rawBody });

		const { httpGraphQLRequest } = mockExecute.mock.calls[0][0];
		expect(httpGraphQLRequest.body).toBe(rawBody);
	});

	it('Should decode base64 body when isBase64Encoded is true.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			status: 200,
			headers: [],
			body: { kind: 'complete' as const, string: '{}' },
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});
		const payload = { query: '{ lists { id } }' };
		const base64Body = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

		await handler({
			httpMethod: 'POST',
			body: base64Body,
			isBase64Encoded: true,
		});

		const { httpGraphQLRequest } = mockExecute.mock.calls[0][0];
		expect(httpGraphQLRequest.body).toEqual(payload);
	});

	it('Should pass context that resolves to empty object.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockImplementation(async (opts) => {
			const context = await opts.context();
			expect(context).toEqual({});
			return {
				status: 200,
				headers: [],
				body: { kind: 'complete' as const, string: '{}' },
			};
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});

		const result = await handler({ httpMethod: 'GET' });

		expect(mockExecute).toHaveBeenCalledTimes(1);
		expect(result.statusCode).toBe(200);
	});

	it('Should pass event headers to the server.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			status: 200,
			headers: [],
			body: { kind: 'complete' as const, string: '{}' },
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});
		const customValues = [chance.word(), chance.word()];
		const authToken = chance.word();

		await handler({
			httpMethod: 'POST',
			body: '{}',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${authToken}`,
				'X-Custom': customValues,
			},
		});

		const { httpGraphQLRequest } = mockExecute.mock.calls[0][0];

		expect(mockExecute).toHaveBeenCalledTimes(1);
		expect(httpGraphQLRequest.headers.get('Content-Type')).toBe('application/json');
		expect(httpGraphQLRequest.headers.get('Authorization')).toBe(`Bearer ${authToken}`);
		expect(httpGraphQLRequest.headers.get('X-Custom')).toBe(customValues.join(', '));
	});

	it('Should not set headers when event.headers is missing.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			status: 200,
			headers: [],
			body: { kind: 'complete' as const, string: '{}' },
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});

		await handler({ httpMethod: 'GET' });

		const { httpGraphQLRequest } = mockExecute.mock.calls[0][0];

		expect(httpGraphQLRequest.headers.get('Content-Type')).toBeUndefined();
	});

	it('Should concatenate chunked response body.', async () => {
		const chunks = ['{"data":', '{"lists":[]}', '}'];
		async function* chunkIterator() {
			for (const chunk of chunks) {
				yield chunk;
			}
		}
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			status: 200,
			headers: [],
			body: { kind: 'chunked' as const, asyncIterator: chunkIterator() },
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});

		const result = await handler({ httpMethod: 'GET' });

		expect(result.statusCode).toBe(200);
		expect(result.body).toBe('{"data":{"lists":[]}}');
	});

	it('Should return empty body when response body is neither complete nor chunked.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			status: 200,
			headers: [],
			body: { kind: 'other' },
		} as unknown as Awaited<ReturnType<GraphqlHandlerDeps['server']['executeHTTPGraphQLRequest']>>);
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});

		const result = await handler({ httpMethod: 'GET' });

		expect(result.statusCode).toBe(200);
		expect(result.body).toBe('');
	});

	it('Should skip undefined and null header values.', async () => {
		const mockEnsureServerStarted = jest.fn().mockResolvedValue(undefined);
		const mockExecute = jest.fn().mockResolvedValue({
			status: 200,
			headers: [],
			body: { kind: 'complete' as const, string: '{}' },
		});
		const handler = createHandler({
			ensureServerStarted: mockEnsureServerStarted,
			server: { executeHTTPGraphQLRequest: mockExecute },
		});

		await handler({
			httpMethod: 'GET',
			headers: {
				Present: 'ok',
				Undefined: undefined,
				Null: null,
			} as unknown as Record<string, string | string[] | undefined>,
		});

		const { httpGraphQLRequest } = mockExecute.mock.calls[0][0];

		expect(httpGraphQLRequest.headers.get('Present')).toBe('ok');
		expect(httpGraphQLRequest.headers.get('Undefined')).toBeUndefined();
		expect(httpGraphQLRequest.headers.get('Null')).toBeUndefined();
	});
});
