import { ensureServerStarted } from './utils.js';

describe('Netlify Functions Utils', () => {
	it('Should start the server only once when attempting to start it multiple times.', async () => {
		const mockStart = jest.fn().mockResolvedValue(undefined);
		const mockServer = { start: mockStart };

		const first = ensureServerStarted(mockServer);
		const second = ensureServerStarted(mockServer);
		await first;
		await second;

		expect(mockStart).toHaveBeenCalledTimes(1);
	});

	it('Should return a Promise that resolves.', async () => {
		const mockStart = jest.fn().mockResolvedValue(undefined);
		const mockServer = { start: mockStart };

		const result = ensureServerStarted(mockServer);

		expect(result).toBeInstanceOf(Promise);
		await expect(result).resolves.toBeUndefined();
	});

	it('Should use default server when called with no argument.', async () => {
		const result = ensureServerStarted();

		expect(result).toBeInstanceOf(Promise);
		await expect(result).resolves.toBeUndefined();
	});
});
