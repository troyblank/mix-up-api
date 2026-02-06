import { server } from '../../src/graphql.ts';

const startCache = new Map<{ start: () => Promise<void> }, Promise<void>>();

export const ensureServerStarted = (
	apolloServer: { start: () => Promise<void> } = server,
): Promise<void> => {
	if (!startCache.has(apolloServer)) {
		startCache.set(apolloServer, apolloServer.start());
	}
	return startCache.get(apolloServer)!;
};
