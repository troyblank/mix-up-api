import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Chance from 'chance';
import { getKafkaPublishConfig } from './getKafkaPublishConfig.ts';

const chance = new Chance(90210);

const ENV_KEYS = ['KAFKA_BOOTSTRAP_SERVER', 'KAFKA_KEY', 'KAFKA_SECRET', 'KAFKA_TOPIC'] as const;

const bootstrapHost = () =>
	`${chance.word({ length: 10 })}:${chance.integer({ min: 1024, max: 65535 })}`;

describe('getKafkaPublishConfig', () => {
	const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

	beforeEach(() => {
		for (const key of ENV_KEYS) {
			originalEnv[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		for (const key of ENV_KEYS) {
			if (originalEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = originalEnv[key];
			}
		}
	});

	it('Returns null when Kafka is not configured.', () => {
		expect(getKafkaPublishConfig()).toBeNull();
	});

	it('Returns null when the bootstrap string is only commas and spaces.', () => {
		process.env.KAFKA_BOOTSTRAP_SERVER = ' , ';
		process.env.KAFKA_KEY = chance.word();
		process.env.KAFKA_SECRET = chance.string();
		process.env.KAFKA_TOPIC = chance.word();

		expect(getKafkaPublishConfig()).toBeNull();
	});

	it('Returns null when the API secret is missing.', () => {
		process.env.KAFKA_BOOTSTRAP_SERVER = bootstrapHost();
		process.env.KAFKA_KEY = chance.word();

		expect(getKafkaPublishConfig()).toBeNull();
	});

	it('Returns null when KAFKA_TOPIC is unset.', () => {
		const broker = bootstrapHost();
		const keyInner = chance.word();
		const secretInner = chance.string();
		process.env.KAFKA_BOOTSTRAP_SERVER = `  ${broker}  `;
		process.env.KAFKA_KEY = `  ${keyInner}  `;
		process.env.KAFKA_SECRET = `  ${secretInner}  `;

		expect(getKafkaPublishConfig()).toBeNull();
	});

	it('Returns null when KAFKA_TOPIC is only whitespace.', () => {
		process.env.KAFKA_BOOTSTRAP_SERVER = bootstrapHost();
		process.env.KAFKA_KEY = chance.word();
		process.env.KAFKA_SECRET = chance.string();
		process.env.KAFKA_TOPIC = '   ';

		expect(getKafkaPublishConfig()).toBeNull();
	});

	it('Returns a config when all required vars are set, trimming strings and splitting brokers.', () => {
		const b1 = bootstrapHost();
		const b2 = bootstrapHost();
		const keyInner = chance.word();
		const secretInner = chance.string();
		const topicInner = `${chance.word()}.${chance.word()}`;
		process.env.KAFKA_BOOTSTRAP_SERVER = `  ${b1},${b2}  `;
		process.env.KAFKA_KEY = `  ${keyInner}  `;
		process.env.KAFKA_SECRET = `  ${secretInner}  `;
		process.env.KAFKA_TOPIC = `  ${topicInner}  `;

		const config = getKafkaPublishConfig();

		expect(config).not.toBeNull();
		expect(config?.brokers).toEqual([b1, b2]);
		expect(config?.key).toBe(keyInner);
		expect(config?.secret).toBe(secretInner);
		expect(config?.topic).toBe(topicInner);
	});
});
