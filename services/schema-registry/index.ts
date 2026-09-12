import * as fs from 'fs';
import * as path from 'path';
import { Compatibility } from '../../infrastructure/lib/config';
import { schemaDir } from '../shared/paths';
import { SchemaDiff, SchemaField, SchemaVersion } from '../shared/types';

const BUILTIN: Record<string, SchemaVersion> = {
  'transaction-v1': {
    name: 'transaction',
    version: 1,
    fields: [
      { name: 'event_id', type: 'string', required: true },
      { name: 'customer_id', type: 'string', required: true },
      { name: 'event_type', type: 'string', required: true },
      { name: 'amount', type: 'decimal', required: true },
      { name: 'currency', type: 'string', required: true },
      { name: 'country', type: 'string', required: false },
      { name: 'device', type: 'string', required: false },
      { name: 'timestamp', type: 'timestamp', required: true },
    ],
  },
  'transaction-v2': {
    name: 'transaction',
    version: 2,
    fields: [
      { name: 'event_id', type: 'string', required: true },
      { name: 'customer_id', type: 'string', required: true },
      { name: 'event_type', type: 'string', required: true },
      { name: 'amount', type: 'decimal', required: true },
      { name: 'currency', type: 'string', required: true },
      { name: 'country', type: 'string', required: false },
      { name: 'device', type: 'string', required: false },
      { name: 'timestamp', type: 'timestamp', required: true },
      { name: 'merchant_id', type: 'string', required: false },
      { name: 'merchant_category', type: 'string', required: false },
    ],
  },
  'transaction-v3': {
    name: 'transaction',
    version: 3,
    fields: [
      { name: 'event_id', type: 'string', required: true },
      { name: 'customer_id', type: 'string', required: true },
      { name: 'event_type', type: 'string', required: true },
      { name: 'amount', type: 'decimal', required: true },
      { name: 'currency', type: 'string', required: true },
      { name: 'country', type: 'string', required: false },
      { name: 'device', type: 'string', required: false },
      { name: 'timestamp', type: 'timestamp', required: true },
      { name: 'merchant_id', type: 'string', required: false },
      { name: 'merchant_category', type: 'string', required: false },
      { name: 'email', type: 'string', required: false, pii: true },
      { name: 'phone', type: 'string', required: false, pii: true },
      { name: 'ip_address', type: 'string', required: false, pii: true },
      { name: 'customer_name', type: 'string', required: false, pii: true },
      { name: 'address', type: 'string', required: false, pii: true },
      { name: 'risk_score', type: 'decimal', required: false },
    ],
  },
};

export function listSchemas(): SchemaVersion[] {
  const fromDisk = loadDiskSchemas();
  const merged = { ...BUILTIN, ...fromDisk };
  return Object.values(merged).sort((a, b) => a.name.localeCompare(b.name) || a.version - b.version);
}

export function getSchema(id: string): SchemaVersion {
  const disk = loadDiskSchemas();
  const found = disk[id] || BUILTIN[id];
  if (!found) {
    throw new Error(`Unknown schema "${id}". Try transaction-v1, transaction-v2 or transaction-v3.`);
  }
  return found;
}

export function diffSchemas(leftId: string, rightId: string): SchemaDiff {
  const left = getSchema(leftId);
  const right = getSchema(rightId);
  const leftMap = new Map(left.fields.map((f) => [f.name, f]));
  const rightMap = new Map(right.fields.map((f) => [f.name, f]));

  const added = right.fields.filter((f) => !leftMap.has(f.name));
  const removed = left.fields.filter((f) => !rightMap.has(f.name));
  const changed: SchemaDiff['changed'] = [];
  for (const field of right.fields) {
    const prev = leftMap.get(field.name);
    if (prev && prev.type !== field.type) {
      changed.push({ name: field.name, from: prev.type, to: field.type });
    }
  }

  return {
    left: leftId,
    right: rightId,
    added,
    removed,
    changed,
    compatibility: classify(left, right, added, removed, changed),
  };
}

function classify(
  left: SchemaVersion,
  right: SchemaVersion,
  added: SchemaField[],
  removed: SchemaField[],
  changed: SchemaDiff['changed'],
): Compatibility {
  if (changed.length > 0) return 'BREAKING';
  const removedRequired = removed.filter((f) => f.required);
  const addedRequired = added.filter((f) => f.required);
  const trulyForward = addedRequired.length === 0 && changed.length === 0;
  const trulyBackward = removedRequired.length === 0 && changed.length === 0;
  if (trulyBackward && trulyForward && added.length + removed.length === 0) return 'FULLY COMPATIBLE';
  if (trulyBackward && trulyForward) {
    return added.length > 0 && removed.length === 0 ? 'BACKWARD COMPATIBLE' : 'FORWARD COMPATIBLE';
  }
  if (trulyBackward) return 'BACKWARD COMPATIBLE';
  if (trulyForward) return 'FORWARD COMPATIBLE';
  void left;
  void right;
  return 'BREAKING';
}

function loadDiskSchemas(): Record<string, SchemaVersion> {
  const dir = schemaDir();
  if (!fs.existsSync(dir)) return {};
  const out: Record<string, SchemaVersion> = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as SchemaVersion & { id?: string };
    const id = parsed.id || `${parsed.name}-v${parsed.version}`;
    out[id] = parsed;
  }
  return out;
}
