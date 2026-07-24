import { Kafka, logLevel, Partitioners } from 'kafkajs';
import type { DeletedListItem } from '../deletedListItem.ts';
import { getKafkaPublishConfig } from './getKafkaPublishConfig.ts';

export type ListItemDeletedEvent = {
	type: 'list_item_deleted';
	itemId: string;
	itemName: string;
	listId: string;
	listName: string;
	listType: DeletedListItem['listType'];
};

export const buildListItemDeletedEvent = (deleted: DeletedListItem): ListItemDeletedEvent => ({
	type: 'list_item_deleted',
	itemId: deleted.itemId,
	itemName: deleted.itemName,
	listId: deleted.listId,
	listName: deleted.listName,
	listType: deleted.listType,
});

// Publishes delete events for pick lists only. Swallows errors so GraphQL delete never fails.
export const publishListItemsDeleted = async (deleted: DeletedListItem[]): Promise<void> => {
	const pickItems = deleted.filter((item) => item.listType === 'pick');
	if (pickItems.length === 0) {
		return;
	}

	const config = getKafkaPublishConfig();
	if (!config) {
		return;
	}

	const kafka = new Kafka({
		clientId: 'mix-up',
		brokers: config.brokers,
		ssl: true,
		sasl: {
			mechanism: 'plain',
			username: config.key,
			password: config.secret,
		},
		logLevel: logLevel.NOTHING,
	});

	const producer = kafka.producer({
		createPartitioner: Partitioners.DefaultPartitioner,
	});

	try {
		await producer.connect();
		await producer.send({
			topic: config.topic,
			messages: pickItems.map((item) => ({
				key: item.listId,
				value: JSON.stringify(buildListItemDeletedEvent(item)),
			})),
		});
	} catch (err) {
		console.error('Failed to publish list item deleted event', err);
	} finally {
		await producer.disconnect().catch(() => {});
	}
};

export const publishListItemDeleted = async (deleted: DeletedListItem): Promise<void> => {
	await publishListItemsDeleted([deleted]);
};
