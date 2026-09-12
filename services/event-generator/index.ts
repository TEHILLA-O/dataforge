import { Scenario } from '../../infrastructure/lib/config';
import { COUNTRIES, CURRENCIES, DEVICES, FinancialEvent, MERCHANT_CATEGORIES } from '../shared/types';
import { Rng } from '../shared/rng';

const FIRST_NAMES = ['Ava', 'Noah', 'Mia', 'Leo', 'Ivy', 'Kai', 'Freya', 'Omar', 'Nia', 'Theo'];
const LAST_NAMES = ['Cole', 'Patel', 'Khan', 'Walsh', 'Adeyemi', 'Novak', 'Silva', 'Chen', 'Okafor', 'Berg'];

export interface GeneratorConfig {
  scenario: Scenario;
  seed?: number;
  schemaVersion?: number;
}

export class EventGenerator {
  private readonly rng: Rng;
  private readonly scenario: Scenario;
  private readonly schemaVersion: number;
  private seq = 0;
  private lastEventId?: string;
  private spikeUntil = 0;
  private produced = 0;

  constructor(config: GeneratorConfig) {
    this.rng = new Rng(config.seed ?? 42);
    this.scenario = config.scenario;
    this.schemaVersion = config.schemaVersion ?? 3;
  }

  next(now = new Date()): FinancialEvent {
    this.produced += 1;
    if (this.rng.chance(0.004)) {
      this.spikeUntil = this.produced + this.rng.int(20, 80);
    }
    const defect = this.chooseDefect();
    return this.build(now, defect);
  }

  nextBatch(count: number, now = new Date()): FinancialEvent[] {
    const events: FinancialEvent[] = [];
    for (let i = 0; i < count; i++) events.push(this.next(now));
    return events;
  }

  partitionKey(event: FinancialEvent): string {
    if (this.scenario === 'iot') return event.device_id || event.device || 'unknown';
    if (this.scenario === 'logs') return event.service || 'app';
    return event.customer_id || event.event_id;
  }

  private chooseDefect(): string | undefined {
    if (this.produced < this.spikeUntil) return 'spike';
    const roll = this.rng.next();
    if (roll < 0.012) return 'missing_customer_id';
    if (roll < 0.018) return 'invalid_currency';
    if (roll < 0.022) return 'negative_amount';
    if (roll < 0.030) return 'duplicate';
    if (roll < 0.034) return 'future_timestamp';
    if (roll < 0.042) return 'late_event';
    if (roll < 0.048) return 'invalid_schema';
    if (roll < 0.062 || this.scenario === 'fraud') return 'fraud';
    return undefined;
  }

  private build(now: Date, defect?: string): FinancialEvent {
    this.seq += 1;
    const customerNum = this.rng.int(1000, 9999);
    const customerId = `CUS-${customerNum}`;
    const first = this.rng.pick(FIRST_NAMES);
    const last = this.rng.pick(LAST_NAMES);
    const country = this.rng.pick(COUNTRIES);
    const event: FinancialEvent = {
      event_id: `evt-${this.rng.int(100000, 999999)}-${this.seq}`,
      customer_id: customerId,
      event_type: this.eventType(),
      amount: this.amount(),
      currency: this.rng.pick(CURRENCIES),
      country,
      device: this.rng.pick(DEVICES),
      timestamp: now.toISOString(),
      schema_version: this.schemaVersion,
    };

    if (this.schemaVersion >= 2) {
      event.merchant_id = `MER-${this.rng.int(100, 899)}`;
      event.merchant_category = this.rng.pick(MERCHANT_CATEGORIES);
    }

    if (this.schemaVersion >= 3) {
      event.email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`;
      event.phone = `+44${this.rng.int(7000000000, 7999999999)}`;
      event.ip_address = `${this.rng.int(10, 200)}.${this.rng.int(0, 255)}.${this.rng.int(0, 255)}.${this.rng.int(1, 254)}`;
      event.customer_name = `${first} ${last}`;
      event.address = `${this.rng.int(1, 120)} ${last} Street, ${country}`;
      event.risk_score = Number(this.rng.amount(0.01, 0.18).toFixed(3));
    }

    if (this.scenario === 'iot') {
      event.event_type = 'telemetry';
      event.device_id = `DEV-${this.rng.int(1000, 4999)}`;
      event.amount = this.rng.amount(0, 100);
    }

    if (this.scenario === 'logs') {
      event.event_type = 'log';
      event.service = this.rng.pick(['payments-api', 'ledger', 'auth', 'notify']);
      event.level = this.rng.chance(0.08) ? 'ERROR' : this.rng.chance(0.2) ? 'WARN' : 'INFO';
      event.message = `${event.service} handled ${event.event_id}`;
      delete event.amount;
      delete event.currency;
    }

    return this.applyDefect(event, defect, now);
  }

  private applyDefect(event: FinancialEvent, defect: string | undefined, now: Date): FinancialEvent {
    if (!defect) return event;
    event._defect = defect;
    switch (defect) {
      case 'missing_customer_id':
        delete event.customer_id;
        break;
      case 'invalid_currency':
        event.currency = 'XXX';
        break;
      case 'negative_amount':
        if (event.amount !== undefined) event.amount = -Math.abs(event.amount);
        break;
      case 'duplicate':
        if (this.lastEventId) event.event_id = this.lastEventId;
        break;
      case 'future_timestamp':
        event.timestamp = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
        break;
      case 'late_event':
        event.timestamp = new Date(now.getTime() - this.rng.int(2, 18) * 60 * 60 * 1000).toISOString();
        break;
      case 'invalid_schema':
        event.event_type = '';
        Object.assign(event, { amount: 'not-a-number' });
        break;
      case 'fraud':
        event.event_type = 'payment';
        event.amount = this.rng.amount(2400, 9800);
        event.country = this.rng.pick(['RU', 'NG', 'XX']);
        event.risk_score = Number(this.rng.amount(0.82, 0.99).toFixed(3));
        event.device = 'mobile';
        break;
      case 'spike':
        event.event_type = 'payment';
        break;
      default:
        break;
    }
    this.lastEventId = event.event_id;
    return event;
  }

  private eventType(): string {
    switch (this.scenario) {
      case 'payments':
        return this.rng.pick(['payment', 'refund', 'card_auth']);
      case 'banking':
        return this.rng.pick(['transfer', 'payment', 'login']);
      case 'fraud':
        return 'payment';
      case 'ecommerce':
        return this.rng.pick(['payment', 'refund', 'signup', 'login']);
      default:
        return 'payment';
    }
  }

  private amount(): number {
    if (this.scenario === 'banking') return this.rng.amount(20, 4000);
    if (this.scenario === 'payments') return this.rng.amount(5, 1800);
    return this.rng.amount(8, 900);
  }
}

export function scenarioFromArgs(value?: string): Scenario {
  const name = (value || 'ecommerce').toLowerCase();
  if (name === 'ecommerce' || name === 'payments' || name === 'banking' || name === 'iot' || name === 'logs' || name === 'fraud') {
    return name;
  }
  throw new Error(`Unknown scenario "${value}". Use ecommerce, payments, banking, iot, logs or fraud.`);
}
