import { HeaderMap } from '@apollo/server';
import { server } from '../../src/graphql.ts';
import { ensureServerStarted } from './utils';
import type { NetlifyEvent, NetlifyHandlerResponse } from './types.ts';

type ApolloResponseBody =
	| { kind: 'complete'; string: string }
	| { kind: 'chunked'; asyncIterator: AsyncIterableIterator<string> };

export type GraphqlHandlerDeps = {
	ensureServerStarted: () => Promise<void>;
	server: {
		executeHTTPGraphQLRequest: (opts: unknown) => Promise<{
			status?: number;
			headers: Iterable<[string, string]>;
			body: ApolloResponseBody;
		}>;
	};
};

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': 'https://mixup.troyblank.com, localhost',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const runHandler = async (
	event: NetlifyEvent,
	deps: GraphqlHandlerDeps,
): Promise<NetlifyHandlerResponse> => {
	// Handle CORS preflight so the browser gets 200 and allows the actual request.
	if (event.httpMethod === 'OPTIONS') {
		return { statusCode: 200, headers: CORS_HEADERS, body: '' };
	}

	await deps.ensureServerStarted();

	const headers = new HeaderMap();
	if (event.headers) {
		for (const [key, value] of Object.entries(event.headers)) {
			if (value !== undefined && value !== null) {
				headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
			}
		}
	}

	const search = event.rawQuery ? `?${event.rawQuery}` : '';
	let body: unknown = undefined;
	if (event.body) {
		const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
		try {
			body = JSON.parse(rawBody);
		} catch {
			body = rawBody;
		}
	}

	const httpGraphQLRequest = {
		method: (event.httpMethod || 'GET').toUpperCase(),
		headers,
		search,
		body,
	};

	const response = await deps.server.executeHTTPGraphQLRequest({
		httpGraphQLRequest,
		context: async () => ({}),
	});

	const responseHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		...CORS_HEADERS,
	};
	for (const [key, value] of response.headers) {
		responseHeaders[key] = value;
	}

	const responseBody =
		response.body.kind === 'complete'
			? response.body.string
			: (async () => {
					let responseText = '';
					const body = response.body;
					if (body.kind === 'chunked') {
						for await (const chunk of body.asyncIterator) {
							responseText += chunk;
						}
					}
					return responseText;
				})();

	return {
		statusCode: response.status ?? 200,
		headers: responseHeaders,
		body: typeof responseBody === 'string' ? responseBody : await responseBody,
	};
};

export const createHandler = (
	deps: GraphqlHandlerDeps = { ensureServerStarted, server } as GraphqlHandlerDeps,
) => {
	return (event: NetlifyEvent) => runHandler(event, deps);
};

export const handler = createHandler();
