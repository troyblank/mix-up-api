import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
	buildDeleteNotificationEmail,
	notifyListItemDeleted,
} from './notifyListItemDeleted.ts';

const ENV_KEYS = ['RESEND_API_KEY', 'DELETE_TO_EMAIL', 'RESEND_FROM_EMAIL'] as const;

const deleted = {
	itemId: 'item-1',
	itemName: 'Inception',
	listId: 'list-1',
	listName: 'Movies',
	listType: 'pick' as const,
};

describe('buildDeleteNotificationEmail', () => {
	it('Builds a subject and body that name the deleted item and list.', () => {
		expect(buildDeleteNotificationEmail(deleted)).toEqual({
			subject: 'Mix-Up: deleted "Inception"',
			text: [
				'A list item was deleted.',
				'',
				'Item: Inception',
				'List: Movies',
				'Item ID: item-1',
				'List ID: list-1',
			].join('\n'),
		});
	});
});

describe('notifyListItemDeleted', () => {
	const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
	const originalFetch = globalThis.fetch;
	let consoleError: ReturnType<typeof jest.spyOn>;

	beforeEach(() => {
		for (const key of ENV_KEYS) {
			originalEnv[key] = process.env[key];
			delete process.env[key];
		}
		consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		for (const key of ENV_KEYS) {
			if (originalEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = originalEnv[key];
			}
		}
		globalThis.fetch = originalFetch;
		consoleError.mockRestore();
	});

	it('Does nothing when the list is not a pick list.', async () => {
		process.env.RESEND_API_KEY = 're_test';
		process.env.DELETE_TO_EMAIL = 'you@example.com';
		process.env.RESEND_FROM_EMAIL = 'Mix-Up <mix-up@mail.troyblank.com>';

		const fetchMock = jest.fn<typeof fetch>();
		globalThis.fetch = fetchMock;

		await notifyListItemDeleted({ ...deleted, listType: 'list' });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('Does nothing when Resend is not configured.', async () => {
		const fetchMock = jest.fn<typeof fetch>();
		globalThis.fetch = fetchMock;

		await notifyListItemDeleted(deleted);

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('Posts to Resend when configured.', async () => {
		process.env.RESEND_API_KEY = 're_test';
		process.env.DELETE_TO_EMAIL = 'you@example.com';
		process.env.RESEND_FROM_EMAIL = 'Mix-Up <mix-up@mail.troyblank.com>';

		const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
			ok: true,
			text: async () => '',
		} as Response);
		globalThis.fetch = fetchMock;

		await notifyListItemDeleted(deleted);

		expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: 'Bearer re_test',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: 'Mix-Up <mix-up@mail.troyblank.com>',
				to: ['you@example.com'],
				subject: 'Mix-Up: deleted "Inception"',
				text: buildDeleteNotificationEmail(deleted).text,
			}),
		});
	});

	it('Logs when Resend returns a non-success status.', async () => {
		process.env.RESEND_API_KEY = 're_test';
		process.env.DELETE_TO_EMAIL = 'you@example.com';
		process.env.RESEND_FROM_EMAIL = 'Mix-Up <mix-up@mail.troyblank.com>';

		globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({
			ok: false,
			status: 422,
			text: async () => 'validation error',
		} as Response);

		await notifyListItemDeleted(deleted);

		expect(consoleError).toHaveBeenCalledWith('Resend API error', 422, 'validation error');
	});

	it('Logs when the Resend request fails.', async () => {
		process.env.RESEND_API_KEY = 're_test';
		process.env.DELETE_TO_EMAIL = 'you@example.com';
		process.env.RESEND_FROM_EMAIL = 'Mix-Up <mix-up@mail.troyblank.com>';

		const networkError = new Error('network down');
		globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(networkError);

		await notifyListItemDeleted(deleted);

		expect(consoleError).toHaveBeenCalledWith('Failed to send delete notification', networkError);
	});
});
