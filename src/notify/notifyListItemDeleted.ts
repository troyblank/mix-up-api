import type { DeletedListItem } from './deletedListItem.ts';
import { getResendNotifyConfig } from './getResendNotifyConfig.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';

export const buildDeleteNotificationEmail = (
	deleted: DeletedListItem,
): { subject: string; text: string } => {
	const subject = `Mix-Up: deleted "${deleted.itemName}"`;
	const text = [
		'A list item was deleted.',
		'',
		`Item: ${deleted.itemName}`,
		`List: ${deleted.listName}`,
		`Item ID: ${deleted.itemId}`,
		`List ID: ${deleted.listId}`,
	].join('\n');

	return { subject, text };
};

export const notifyListItemDeleted = async (deleted: DeletedListItem): Promise<void> => {
	if (deleted.listType !== 'pick') {
		return;
	}

	const config = getResendNotifyConfig();
	if (!config) {
		return;
	}

	const { subject, text } = buildDeleteNotificationEmail(deleted);

	try {
		const response = await fetch(RESEND_API_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: config.from,
				to: [config.to],
				subject,
				text,
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			console.error('Resend API error', response.status, body);
		}
	} catch (err) {
		console.error('Failed to send delete notification', err);
	}
};
