export type KafkaPublishConfig = {
	brokers: string[];
	key: string;
	secret: string;
	topic: string;
};

export const getKafkaPublishConfig = (): KafkaPublishConfig | null => {
	const bootstrap = process.env.KAFKA_BOOTSTRAP_SERVER?.trim();
	const key = process.env.KAFKA_KEY?.trim();
	const secret = process.env.KAFKA_SECRET?.trim();
	const topic = process.env.KAFKA_TOPIC?.trim();
	if (!bootstrap || !key || !secret || !topic) {
		return null;
	}

	const brokers = bootstrap.split(',').map((b) => b.trim()).filter(Boolean);
	if (brokers.length === 0) {
		return null;
	}

	return { brokers, key, secret, topic };
};
