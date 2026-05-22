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
| `RESEND_API_KEY` | No | [Resend](https://resend.com) API key. Omit all three Resend variables to skip delete-notification emails. |
| `DELETE_TO_EMAIL` | No* | Inbox that receives emails when an item is deleted from a **pick** list. |
| `RESEND_FROM_EMAIL` | No* | Sender email address on your verified Resend domain.
\* All three Resend variables are required together for delete notifications to send.

Set the same variables in **Netlify** (Site settings → Environment variables) for deployed functions, then redeploy after changes.

## Commands

| Command     | Result                                  |
| ----------- | --------------------------------------- |
| yarn lint   | Checks repo for any lint or tsc issues. |
| yarn start  | Runs Apollo sandbox.                    |
| yarn test   | Runs unit tests.                        |
