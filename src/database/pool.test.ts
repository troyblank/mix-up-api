import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { resetMockPgRows } from './__mocks__/pg.ts';

const originalDatabaseUrl = process.env.DATABASE_URL;

async function loadPoolAndPgMock() {
	const [{ getPool }, pg] = await Promise.all([import('./pool.ts'), import('pg')]);
	const PoolCtor = jest.mocked(pg.default.Pool);
	return { getPool, PoolCtor };
}

describe('DB Pooling', () => {
	beforeEach(() => {
		resetMockPgRows();
	});

	afterEach(() => {
		if (originalDatabaseUrl === undefined) {
			delete process.env.DATABASE_URL;
		} else {
			process.env.DATABASE_URL = originalDatabaseUrl;
		}

		jest.resetModules();
	});

	it('Creates one Pool and returns the same instance when the database connection string is set.', async () => {
		process.env.DATABASE_URL = 'postgresql://localhost:5432/testdb';

		const { getPool, PoolCtor } = await loadPoolAndPgMock();
		const first = getPool();
		const second = getPool();

		expect(first).toBe(second);
		expect(PoolCtor).toHaveBeenCalledTimes(1);
		expect(PoolCtor).toHaveBeenCalledWith({ connectionString: process.env.DATABASE_URL });
	});

	it('Does not create a pool when the database connection string is not set.', async () => {
		delete process.env.DATABASE_URL;

		const { getPool, PoolCtor } = await loadPoolAndPgMock();

		expect(getPool()).toBeNull();
		expect(getPool()).toBeNull();
		expect(PoolCtor).not.toHaveBeenCalled();
	});

	it('Required Pool throws when the database connection string is not set.', async () => {
		delete process.env.DATABASE_URL;

		const { requirePool } = await import('./pool.ts');
		expect(() => requirePool()).toThrow(/Database is not configured/);
	});

	it('Creates a pool after the database connection string is set if no pool was cached yet.', async () => {
		delete process.env.DATABASE_URL;

		const { getPool, PoolCtor } = await loadPoolAndPgMock();
		expect(getPool()).toBeNull();

		process.env.DATABASE_URL = 'postgresql://example/db';
		const pool = getPool();

		expect(pool).not.toBeNull();
		expect(PoolCtor).toHaveBeenCalledTimes(1);
	});
});
