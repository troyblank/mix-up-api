type HeadersCarrier = { headers?: Record<string, string | string[] | undefined | null> };

export const getAuthorizationHeaderFromEvent = (event: HeadersCarrier): string | undefined => {
	const headers = event.headers;

	if (!headers) return undefined;

	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === 'authorization' && value != null) {
			return Array.isArray(value) ? value[0] : String(value);
		}
	}

	return undefined;
};
