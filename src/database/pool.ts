import pg from 'pg';

let pool: pg.Pool | null | undefined;

export const getPool = (): pg.Pool | null => {
	const url = process.env.DATABASE_URL;

	if (pool !== undefined) return pool;
	if (!url) return null;

	pool = new pg.Pool({ connectionString: url });
	return pool;
};

export const requirePool = (): pg.Pool => {
	const p = getPool();
	if (!p) {
		throw new Error('Database is not configured: set the DATABASE_URL environment variable.');
	}
	return p;
};
