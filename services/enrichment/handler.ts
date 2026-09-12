import { KinesisStreamEvent } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { enrich } from './index';
import { FinancialEvent } from '../shared/types';

const s3 = new S3Client({});

export async function handler(event: KinesisStreamEvent): Promise<void> {
  const bucket = process.env.LAKE_BUCKET;
  if (!bucket) throw new Error('LAKE_BUCKET is not set');

  const records: ReturnType<typeof enrich>[] = [];
  for (const record of event.Records) {
    const payload = Buffer.from(record.kinesis.data, 'base64').toString('utf8');
    const parsed = JSON.parse(payload) as FinancialEvent;
    records.push(enrich(parsed));
  }

  const now = new Date();
  const key = [
    'raw/transactions',
    `year=${now.getUTCFullYear()}`,
    `month=${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
    `day=${String(now.getUTCDate()).padStart(2, '0')}`,
    `hour=${String(now.getUTCHours()).padStart(2, '0')}`,
    `${now.toISOString().replace(/[:.]/g, '-')}-${records.length}.json`,
  ].join('/');

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: records.map((row) => JSON.stringify(row)).join('\n'),
      ContentType: 'application/x-ndjson',
    }),
  );
}
