import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { getResendNotifyConfig } from './getResendNotifyConfig.ts';

const ENV_KEYS = ['RESEND_API_KEY', 'DELETE_TO_EMAIL', 'RESEND_FROM_EMAIL'] as const;

describe('getResendNotifyConfig', () => {
	const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

	beforeEach(() => {
		for (const key of ENV_KEYS) {
			originalEnv[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		for (const key of ENV_KEYS) {
			if (originalEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = originalEnv[key];
			}
		}
	});

	it('Returns null when Resend is not configured.', () => {
		expect(getResendNotifyConfig()).toBeNull();
	});

	it('Returns null when RESEND_FROM_EMAIL is missing.', () => {
		process.env.RESEND_API_KEY = 're_test';
		process.env.DELETE_TO_EMAIL = 'you@example.com';

		expect(getResendNotifyConfig()).toBeNull();
	});

	it('Returns null when only the API key is set.', () => {
		process.env.RESEND_API_KEY = 're_test';
		expect(getResendNotifyConfig()).toBeNull();
	});

	it('Returns config when all Resend env vars are set.', () => {
		process.env.RESEND_API_KEY = '  re_test  ';
		process.env.DELETE_TO_EMAIL = '  you@example.com  ';
		process.env.RESEND_FROM_EMAIL = '  Mix-Up <mix-up@mail.troyblank.com>  ';

		expect(getResendNotifyConfig()).toEqual({
			apiKey: 're_test',
			to: 'you@example.com',
			from: 'Mix-Up <mix-up@mail.troyblank.com>',
		});
	});
});
