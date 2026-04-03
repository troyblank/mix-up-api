/** @type {import('jest').Config} */
const baseConfig = {
	coveragePathIgnorePatterns: ['<rootDir>/src/database/'],
	coverageReporters: ['lcov', 'text-summary'],
	coverageThreshold: {
		global: {
			statements: 100,
			branches: 100,
			functions: 100,
			lines: 100,
		},
	},
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	preset: 'ts-jest/presets/default-esm',
	setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
	testEnvironment: 'node',
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'node',
					allowImportingTsExtensions: true,
					noEmit: true,
				},
			},
		],
	},
};

/** @type {import('jest').Config} */
module.exports = {
	projects: [
		{
			...baseConfig,
			displayName: 'pool',
			moduleNameMapper: {
				...baseConfig.moduleNameMapper,
				'^pg$': '<rootDir>/src/database/__mocks__/pg.ts',
			},
			testMatch: ['<rootDir>/src/database/pool.test.ts', '<rootDir>/src/graphql.test.ts'],
		},
		{
			...baseConfig,
			displayName: 'main',
			testMatch: ['**/*.test.ts'],
			testPathIgnorePatterns: ['<rootDir>/src/database/pool.test.ts', '<rootDir>/src/graphql.test.ts'],
		},
	],
};
