import { describe, expect, it } from '@jest/globals';
import { getAuthorizationHeaderFromEvent } from './netlifyHeaders.ts';

describe('Netlify Headers.', () => {
	it('Uses the first header when the platform sends more than one authorization value.', () => {
		const result = getAuthorizationHeaderFromEvent({
			headers: {
				Authorization: ['Bearer first-token', 'Bearer ignored'],
			},
		});

		expect(result).toBe('Bearer first-token');
	});

	it('Reads a single authorization value the usual way.', () => {
		expect(
			getAuthorizationHeaderFromEvent({
				headers: { Authorization: 'Bearer plain' },
			}),
		).toBe('Bearer plain');
	});

	it('Still finds the header when the name uses different capitalization.', () => {
		expect(
			getAuthorizationHeaderFromEvent({
				headers: { authorization: ['Bearer from-array'] },
			}),
		).toBe('Bearer from-array');
	});

	it('Says there is no auth header when the request has no headers, empty headers, or no authorization field.', () => {
		expect(getAuthorizationHeaderFromEvent({})).toBeUndefined();
		expect(getAuthorizationHeaderFromEvent({ headers: {} })).toBeUndefined();
		expect(
			getAuthorizationHeaderFromEvent({
				headers: { 'Content-Type': 'application/json' },
			}),
		).toBeUndefined();
	});

	it('Says there is no auth header when the authorization slot has no value.', () => {
		expect(
			getAuthorizationHeaderFromEvent({
				headers: { Authorization: null },
			}),
		).toBeUndefined();
	});
});
