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

const ALLOWED_HOSTNAMES = new Set([
	'localhost',
	'mixup.troyblank.com',
]);

function isOriginAllowed(hostname: string): boolean {
	if (ALLOWED_HOSTNAMES.has(hostname)) return true;
	// Allow Netlify deploy previews: deploy-preview-N--mix-up.netlify.app
	if (hostname.endsWith('mix-up.netlify.app')) {
		return true;
	}
	return false;
}

function getCorsHeaders(event: NetlifyEvent): Record<string, string> {
	const headers: Record<string, string> = {
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	};
	const raw = event.headers?.origin ?? event.headers?.Origin;
	const origin = Array.isArray(raw) ? raw[0] : raw;
	if (origin) {
		try {
			const url = new URL(origin);
			if (isOriginAllowed(url.hostname)) {
				headers['Access-Control-Allow-Origin'] = origin;
			}
		} catch {
			// ignore invalid origin
		}
	}
	return headers;
}

const runHandler = async (
	event: NetlifyEvent,
	deps: GraphqlHandlerDeps,
): Promise<NetlifyHandlerResponse> => {
	if (event.httpMethod === 'OPTIONS') {
		return { statusCode: 200, headers: getCorsHeaders(event), body: '' };
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
		...getCorsHeaders(event),
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
