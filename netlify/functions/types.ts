export type NetlifyEvent = {
	httpMethod?: string;
	body?: string | null;
	headers?: Record<string, string | string[] | undefined>;
	rawQuery?: string;
	isBase64Encoded?: boolean;
};

export type NetlifyHandlerResponse = {
	statusCode: number;
	headers: Record<string, string>;
	body: string;
};
