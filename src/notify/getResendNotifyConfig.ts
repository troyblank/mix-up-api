export type ResendNotifyConfig = {
	apiKey: string;
	to: string;
	from: string;
};

export const getResendNotifyConfig = (): ResendNotifyConfig | null => {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	const to = process.env.DELETE_TO_EMAIL?.trim();
	const from = process.env.RESEND_FROM_EMAIL?.trim();
	if (!apiKey || !to || !from) {
		return null;
	}

	return { apiKey, to, from };
};
