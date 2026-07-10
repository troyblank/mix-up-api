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

// Publishes a delete event for pick lists only. Swallows errors so GraphQL delete never fails.
export const publishListItemDeleted = async (deleted: DeletedListItem): Promise<void> => {
	if (deleted.listType !== 'pick') {
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
		const value = JSON.stringify(buildListItemDeletedEvent(deleted));
		await producer.send({
			topic: config.topic,
			messages: [{ key: deleted.listId, value }],
		});
	} catch (err) {
		console.error('Failed to publish list item deleted event', err);
	} finally {
		await producer.disconnect().catch(() => {});
	}
};
