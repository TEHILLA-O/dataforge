import { createHash } from 'crypto';
import { PII_COLUMNS } from '../../infrastructure/lib/config';
import { FinancialEvent } from '../shared/types';

export type PiiPolicy = 'administrator' | 'analyst' | 'restricted';

export function maskEmail(value: string): string {
  const [user, domain] = value.split('@');
  if (!domain) return '***';
  return `${user[0] ?? '*'}******@${domain}`;
}

export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export function tokenize(value: string): string {
  return `tok_${hashValue(value).slice(0, 12)}`;
}

export function applyPii(event: FinancialEvent, policy: PiiPolicy): FinancialEvent {
  if (policy === 'administrator') return { ...event };
  const copy: FinancialEvent = { ...event };
  if (copy.email) copy.email = maskEmail(copy.email);
  if (copy.phone) copy.phone = hashValue(copy.phone);
  if (copy.ip_address) copy.ip_address = hashValue(copy.ip_address);
  if (copy.customer_name) copy.customer_name = tokenize(copy.customer_name);
  if (copy.address) copy.address = tokenize(copy.address);
  if (policy === 'restricted') {
    delete copy.email;
    delete copy.phone;
    delete copy.ip_address;
    delete copy.customer_name;
    delete copy.address;
  }
  return copy;
}

export function isPiiColumn(name: string): boolean {
  return (PII_COLUMNS as readonly string[]).includes(name);
}
