import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { deployedApiEnv } from './env';

export const API_PREFIX = '/api/v1';
export const REFRESH_COOKIE = 'bl_refresh';

/**
 * AUTH_THROTTLE (src/modules/auth/auth.throttle.ts) allows 10 calls a minute per
 * route and client. The budget stays one under it and the window a little over,
 * so the suites never trip it by accident; the one test that trips it on purpose
 * spends the whole budget afterwards.
 */
const THROTTLED_ROUTES = [
  '/auth/login',
  '/auth/refresh',
  '/invitations/lookup',
  '/invitations/accept',
];
const AUTH_BUDGET = 9;
const AUTH_WINDOW_MS = 62_000;
const THROTTLED_ATTEMPTS = 3;

// A file and not a module variable: the global setup runs in another process
// than the tests, and both draw from the same budget.
const BUDGET_FILE = join(
  process.cwd(),
  'node_modules',
  '.cache',
  'beverage-ledger',
  'auth-throttle.json',
);

type Budget = Record<string, number[]>;

function readBudget(): Budget {
  try {
    return JSON.parse(readFileSync(BUDGET_FILE, 'utf8')) as Budget;
  } catch {
    return {};
  }
}

function writeBudget(budget: Budget): void {
  mkdirSync(dirname(BUDGET_FILE), { recursive: true });
  writeFileSync(BUDGET_FILE, JSON.stringify(budget));
}

async function takeAuthSlot(route: string): Promise<void> {
  for (;;) {
    const now = Date.now();
    const budget = readBudget();
    const recent = (budget[route] ?? []).filter((at) => now - at < AUTH_WINDOW_MS);

    if (recent.length < AUTH_BUDGET) {
      budget[route] = [...recent, now];
      writeBudget(budget);
      return;
    }

    await sleep(AUTH_WINDOW_MS - (now - recent[0]!) + 250);
  }
}

/** Marks a route's budget as spent, after a test that exhausted the real limit. */
export function spendAuthBudget(route: string): void {
  const budget = readBudget();
  budget[route] = Array.from({ length: AUTH_BUDGET }, () => Date.now());
  writeBudget(budget);
}

export interface ApiResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
  /** Cookies the response set, by name. An empty value means the cookie was cleared. */
  cookies: Record<string, string>;
}

export interface RequestOptions {
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Sent as `Cookie: bl_refresh=<value>`. */
  refreshToken?: string;
  /** Skips the throttle budget; only for the test that exceeds the limit on purpose. */
  unthrottled?: boolean;
}

function cookiesOf(headers: Headers): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const line of headers.getSetCookie()) {
    const [pair] = line.split(';');
    const separator = pair!.indexOf('=');
    cookies[pair!.slice(0, separator).trim()] = decodeURIComponent(
      pair!.slice(separator + 1).trim(),
    );
  }
  return cookies;
}

/**
 * Calls the deployed API. `path` is relative to `/api/v1`, unless it starts with
 * `/docs`, which Swagger serves outside the prefix.
 */
export async function call<T = unknown>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const route = path.split('?')[0]!;
  if (options.unthrottled || !THROTTLED_ROUTES.includes(route)) {
    return send<T>(method, path, options);
  }

  // The budget only sees this job. Another one calling the same API from the same
  // address (the next job, the web repo's suites) spends the same limit, so a 429
  // waits out the window and tries again rather than failing the suite.
  for (let attempt = 1; ; attempt++) {
    await takeAuthSlot(route);
    const response = await send<T>(method, path, options);
    if (response.status !== 429 || attempt === THROTTLED_ATTEMPTS) return response;
    spendAuthBudget(route);
  }
}

async function send<T>(
  method: string,
  path: string,
  options: RequestOptions,
): Promise<ApiResponse<T>> {
  const { apiUrl } = deployedApiEnv();
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.refreshToken)
    headers.Cookie = `${REFRESH_COOKIE}=${encodeURIComponent(options.refreshToken)}`;

  const url = `${apiUrl}${path.startsWith('/docs') ? '' : API_PREFIX}${path}`;
  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
  });

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    // Not JSON: the test gets the raw text.
  }

  return {
    status: response.status,
    headers: response.headers,
    body: body as T,
    cookies: cookiesOf(response.headers),
  };
}

/**
 * Render's free plan sleeps after 15 idle minutes and takes about 50s to wake.
 * @throws {Error} when the API is still not healthy after `timeoutMs`.
 */
export async function waitForApi(timeoutMs = 180_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = '';

  while (Date.now() < deadline) {
    try {
      const health = await call<{ status?: string }>('GET', '/health');
      if (health.status === 200 && health.body.status === 'ok') return;
      last = `HTTP ${health.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await sleep(5_000);
  }

  throw new Error(`The deployed API did not become healthy: ${last}`);
}
