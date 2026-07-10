# MIX UP API
[![test](https://github.com/troyblank/mix-up-api/actions/workflows/test.yml/badge.svg)](https://github.com/troyblank/mix-up-api/actions/workflows/test.yml)

## Global Requirements
* nvm

## Setup

1. run `nvm use`
2. run `yarn install`
3. copy `.env.example` to `.env` and set the variables below

## Environment variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `DATABASE_URL` | Yes | Supabase connection string (Project Settings → Database → Connection string URI). |
| `KAFKA_BOOTSTRAP_SERVER` | No | Confluent bootstrap server (`host:port`). Comma‑separate if you have several brokers. Omit all `KAFKA_*` vars to skip publishing delete events. |
| `KAFKA_KEY` | No | Confluent **Kafka cluster** API key (used as SASL username). |
| `KAFKA_SECRET` | No | Secret for that API key (used as SASL password). |
| `KAFKA_TOPIC` | With Kafka | Topic for list-item delete events. **Required** when bootstrap/key/secret are set (no default). Must match the **notifications** consumer. |

Delete notification email is handled by the separate **notifications** project (Kafka consumer + Resend).

Set the same variables in **Netlify** (Site settings → Environment variables) for deployed functions, then redeploy after changes. Add the `KAFKA_*` variables when the producer should run in production.

## Commands

| Command     | Result                                  |
| ----------- | --------------------------------------- |
| yarn lint   | Checks repo for any lint or tsc issues. |
| yarn start  | Runs Apollo sandbox.                    |
| yarn test   | Runs unit tests.                        |
