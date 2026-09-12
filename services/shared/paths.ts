import * as fs from 'fs';
import * as path from 'path';

export function repoRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

export function dataDir(): string {
  return process.env.DATAFORGE_HOME || path.join(process.cwd(), '.dataforge');
}

export function lakeDir(): string {
  return process.env.DATAFORGE_LAKE_DIR || path.join(dataDir(), 'lake');
}

export function statePath(): string {
  return path.join(dataDir(), 'state.json');
}

export function schemaDir(): string {
  return path.join(repoRoot(), 'schemas');
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(file: string, value: unknown): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function appendJsonl(file: string, rows: unknown[]): void {
  if (rows.length === 0) return;
  ensureDir(path.dirname(file));
  const body = rows.map((row) => JSON.stringify(row)).join('\n') + '\n';
  fs.appendFileSync(file, body, 'utf8');
}

export function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

export function walkFiles(dir: string, suffix = '.jsonl'): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, suffix));
    else if (entry.name.endsWith(suffix)) out.push(full);
  }
  return out;
}
