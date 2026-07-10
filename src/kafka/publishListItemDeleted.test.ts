import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import Chance from 'chance';
import {
	buildListItemDeletedEvent,
	publishListItemDeleted,
} from './publishListItemDeleted.ts';

const chance = new Chance(88721);
const sampleBroker = `${chance.word({ length: 8 })}:${chance.integer({ min: 10000, max: 20000 })}`;
const sampleKey = chance.word();
const sampleSecret = chance.string({ length: 24 });
const sampleTopic = `${chance.word()}.${chance.word()}`;

type TestProducer = {
	connect: ReturnType<typeof jest.fn>;
	send: ReturnType<typeof jest.fn>;
	disconnect: ReturnType<typeof jest.fn>;
};

declare global {
	// eslint-disable-next-line no-var
	var __mixUpKafkaTestProducer: TestProducer | undefined;
}

jest.mock('kafkajs', () => ({
	Partitioners: { DefaultPartitioner: jest.fn() },
	logLevel: { NOTHING: 0 },
	Kafka: class {
		producer() {
			const producer = globalThis.__mixUpKafkaTestProducer;
			if (!producer) {
				throw new Error('Tests must assign globalThis.__mixUpKafkaTestProducer before publishing.');
			}
			return producer;
		}
	},
}));

const ENV_KEYS = ['KAFKA_BOOTSTRAP_SERVER', 'KAFKA_KEY', 'KAFKA_SECRET', 'KAFKA_TOPIC'] as const;

const deletedPick = {
	itemId: 'item-1',
	itemName: 'Inception',
	listId: 'list-1',
	listName: 'Movies',
	listType: 'pick' as const,
};

describe('buildListItemDeletedEvent', () => {
	it('Builds the wire payload for a deleted list item.', () => {
		expect(buildListItemDeletedEvent(deletedPick)).toEqual({
			type: 'list_item_deleted',
			itemId: 'item-1',
			itemName: 'Inception',
			listId: 'list-1',
			listName: 'Movies',
			listType: 'pick',
		});
	});
});

describe('publishListItemDeleted', () => {
	const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

	beforeEach(() => {
		for (const key of ENV_KEYS) {
			originalEnv[key] = process.env[key];
			delete process.env[key];
		}

		globalThis.__mixUpKafkaTestProducer = {
			connect: jest.fn(() => Promise.resolve()),
			send: jest.fn(() => Promise.resolve()),
			disconnect: jest.fn(() => Promise.resolve()),
		};
	});

	afterEach(() => {
		globalThis.__mixUpKafkaTestProducer = undefined;
		for (const key of ENV_KEYS) {
			if (originalEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = originalEnv[key];
			}
		}
	});

	it('Does nothing when the list is not a pick list.', async () => {
		process.env.KAFKA_BOOTSTRAP_SERVER = sampleBroker;
		process.env.KAFKA_KEY = sampleKey;
		process.env.KAFKA_SECRET = sampleSecret;

		await publishListItemDeleted({ ...deletedPick, listType: 'list' });

		expect(globalThis.__mixUpKafkaTestProducer?.connect).not.toHaveBeenCalled();
	});

	it('Does nothing when Kafka env is incomplete.', async () => {
		process.env.KAFKA_BOOTSTRAP_SERVER = sampleBroker;

		await publishListItemDeleted(deletedPick);

		expect(globalThis.__mixUpKafkaTestProducer?.connect).not.toHaveBeenCalled();
	});

	it('Connects, sends JSON to the configured topic, then disconnects.', async () => {
		process.env.KAFKA_BOOTSTRAP_SERVER = sampleBroker;
		process.env.KAFKA_KEY = sampleKey;
		process.env.KAFKA_SECRET = sampleSecret;
		process.env.KAFKA_TOPIC = sampleTopic;

		const p = globalThis.__mixUpKafkaTestProducer;

		await publishListItemDeleted(deletedPick);

		expect(p?.connect).toHaveBeenCalledTimes(1);
		expect(p?.send).toHaveBeenCalledWith({
			topic: sampleTopic,
			messages: [
				{
					key: 'list-1',
					value: JSON.stringify(buildListItemDeletedEvent(deletedPick)),
				},
			],
		});
		expect(p?.disconnect).toHaveBeenCalledTimes(1);
	});

	it('Logs and resolves when send fails.', async () => {
		process.env.KAFKA_BOOTSTRAP_SERVER = sampleBroker;
		process.env.KAFKA_KEY = sampleKey;
		process.env.KAFKA_SECRET = sampleSecret;
		process.env.KAFKA_TOPIC = sampleTopic;

		const p = globalThis.__mixUpKafkaTestProducer;
		const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
		p?.send.mockImplementationOnce(() => Promise.reject(new Error('broker refused')));

		await expect(publishListItemDeleted(deletedPick)).resolves.toBeUndefined();

		expect(consoleError).toHaveBeenCalledWith(
			'Failed to publish list item deleted event',
			expect.any(Error),
		);
		consoleError.mockRestore();
	});

	it('Swallows disconnect failures after a successful send.', async () => {
		process.env.KAFKA_BOOTSTRAP_SERVER = sampleBroker;
		process.env.KAFKA_KEY = sampleKey;
		process.env.KAFKA_SECRET = sampleSecret;
		process.env.KAFKA_TOPIC = sampleTopic;

		const p = globalThis.__mixUpKafkaTestProducer;
		p?.disconnect.mockImplementationOnce(() => Promise.reject(new Error('already closed')));

		await expect(publishListItemDeleted(deletedPick)).resolves.toBeUndefined();
	});
});
