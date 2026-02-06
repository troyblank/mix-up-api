/** @type {import('jest').Config} */
module.exports = {
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
	testMatch: ['**/*.test.ts'],
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
