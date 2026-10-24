// The traffic Keploy records: one request per path of RF-01, 03, 06, 09, 29 and
// 30, against the API started under `keploy record`. Keploy captures each call
// with the Postgres traffic behind it, and `keploy test` replays the calls with
// the database mocked from what it recorded. CI records the previous commit and
// replays against the current one, so a changed answer is a regression.
//
// Read-mostly on purpose. A write the replay cannot reproduce byte for byte (a
// new refresh token, a fresh invitation) only adds noise to the comparison, so
// the only writes left are the sign-ins every authenticated path needs.
const API = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const FOREIGN_ID = '00000000-0000-4000-8000-000000000000';

function credentials(role) {
  const email = process.env[`CI_${role}_EMAIL`];
  const password = process.env[`CI_${role}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing CI_${role}_EMAIL or CI_${role}_PASSWORD`);
  return { email, password };
}

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  console.log(`${response.status} ${method} ${path}`);
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function signIn(role) {
  const { status, body } = await call('POST', '/auth/login', { body: credentials(role) });
  if (status !== 200) throw new Error(`Sign-in as ${role} answered ${status}`);
  return body.accessToken;
}

const expectations = [];
const expect = (label, actual, wanted) => {
  if (actual !== wanted) expectations.push(`${label}: expected ${wanted}, got ${actual}`);
};

// Up and answering before anything is recorded.
for (let attempt = 0; ; attempt += 1) {
  try {
    if ((await fetch(`${API}/health`)).ok) break;
  } catch {
    // Not listening yet.
  }
  if (attempt === 60) throw new Error('The API did not come up');
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}

// RF-01
const operator = await signIn('OPERATOR');
const admin = await signIn('ADMIN');
expect(
  'RF-01 unknown account',
  (
    await call('POST', '/auth/login', {
      body: { email: 'nadie+keploy@beverageledger.test', password: 'NoExiste-2026' },
    })
  ).status,
  401,
);
expect('RF-01 session', (await call('GET', '/auth/me', { token: operator })).status, 200);
expect('RF-01 no token', (await call('GET', '/auth/me')).status, 401);

// RF-03
expect('RF-03 list', (await call('GET', '/invitations?pageSize=5', { token: admin })).status, 200);
expect(
  'RF-03 unknown token',
  (await call('POST', '/invitations/lookup', { body: { token: 'token-keploy' } })).status,
  404,
);
expect('RF-03 operator', (await call('GET', '/invitations', { token: operator })).status, 403);

// RF-06: every attempt is refused, so the CI account keeps its password.
expect(
  'RF-06 weak password',
  (
    await call('PUT', '/users/me/password', {
      token: operator,
      body: { currentPassword: credentials('OPERATOR').password, newPassword: 'corta' },
    })
  ).status,
  400,
);
expect(
  'RF-06 no token',
  (
    await call('PUT', '/users/me/password', {
      body: { currentPassword: 'x', newPassword: 'Nueva-Segura-2026x' },
    })
  ).status,
  401,
);

// RF-09
const products = await call('GET', '/products?pageSize=5', { token: admin });
expect('RF-09 list', products.status, 200);
const [product] = products.body.data;
expect('RF-09 one', (await call('GET', `/products/${product.id}`, { token: admin })).status, 200);
expect(
  'RF-09 negative minimum',
  (await call('PATCH', `/products/${product.id}`, { token: admin, body: { minimumStock: -1 } }))
    .status,
  400,
);
expect(
  'RF-09 foreign id',
  (await call('GET', `/products/${FOREIGN_ID}`, { token: admin })).status,
  404,
);
expect(
  'RF-09 operator writes',
  (await call('POST', '/products', { token: operator, body: {} })).status,
  403,
);

// RF-29
expect('RF-29 page', (await call('GET', '/users?page=1&pageSize=5', { token: admin })).status, 200);
expect('RF-29 page size', (await call('GET', '/users?pageSize=500', { token: admin })).status, 400);
expect(
  'RF-29 foreign id',
  (await call('GET', `/users/${FOREIGN_ID}`, { token: admin })).status,
  404,
);
expect('RF-29 operator', (await call('GET', '/users', { token: operator })).status, 403);

// RF-30
expect(
  'RF-30 by entity',
  (await call('GET', '/audit-logs?entity=product&pageSize=5', { token: admin })).status,
  200,
);
expect(
  'RF-30 bad entity',
  (await call('GET', '/audit-logs?entity=planeta', { token: admin })).status,
  400,
);
expect('RF-30 operator', (await call('GET', '/audit-logs', { token: operator })).status, 403);

// The recording may come from an older version that answers differently: that
// is the replay's verdict to give, not this script's. Only a failed sign-in,
// which means the environment is broken, stops it above.
if (expectations.length > 0) {
  console.warn(
    `::warning::The recorded version answered unexpectedly:\n${expectations.join('\n')}`,
  );
} else {
  console.log('Traffic recorded: every path answered as expected.');
}
