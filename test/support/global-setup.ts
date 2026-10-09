import type { TestProject } from 'vitest/node';
import { deployedApiEnv } from './env';
import { call, waitForApi } from './http';
import { login, sessionFrom, strongPassword, type SessionBody } from './session';

export const CI_PRODUCT_NAME = '[CI] Producto de prueba';

export interface RunUser {
  id: string;
  email: string;
  password: string;
  invitationId: string;
  invitationToken: string;
  /** What `POST /invitations/accept` answered, so RF-03 can check it. */
  acceptStatus: number;
  acceptBody: SessionBody;
  refreshToken: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    adminToken: string;
    managerToken: string;
    operatorToken: string;
    adminId: string;
    operatorId: string;
    ciProductId: string;
    runUser: RunUser | null;
  }
}

interface Page<T> {
  data: T[];
}

async function ensureCiProduct(adminToken: string): Promise<string> {
  const search = encodeURIComponent(CI_PRODUCT_NAME);
  const found = await call<Page<{ id: string; name: string }>>(
    'GET',
    `/products?search=${search}&status=all`,
    {
      token: adminToken,
    },
  );
  const existing = found.body.data?.find((product) => product.name === CI_PRODUCT_NAME);
  if (existing) return existing.id;

  const categories = await call<Page<{ id: string }>>('GET', '/categories?pageSize=1', {
    token: adminToken,
  });
  const created = await call<{ id: string }>('POST', '/products', {
    token: adminToken,
    body: { name: CI_PRODUCT_NAME, categoryId: categories.body.data[0]!.id, caseSize: 6 },
  });
  if (created.status !== 201)
    throw new Error(`Could not create the CI product: HTTP ${created.status}`);
  return created.body.id;
}

/**
 * One member per run, as agreed: accepting an invitation creates a user, and a
 * user cannot be deleted, so the run creates exactly one and suspends it at the
 * end. Only the `api` project creates it; `seguridad` never needs a real one.
 */
async function createRunUser(adminToken: string): Promise<RunUser> {
  const email = `ci+${Date.now()}@beverageledger.test`;
  const issued = await call<{ invitation: { id: string }; acceptUrl: string }>(
    'POST',
    '/invitations',
    {
      token: adminToken,
      body: { email, role: 'OPERATOR' },
    },
  );
  if (issued.status !== 201)
    throw new Error(`Could not invite the run user: HTTP ${issued.status}`);

  const invitationToken = new URL(issued.body.acceptUrl).pathname.split('/').pop()!;
  const password = strongPassword();
  const accepted = await call<SessionBody>('POST', '/invitations/accept', {
    body: { token: invitationToken, name: `CI ${email}`, password },
  });
  if (accepted.status !== 201)
    throw new Error(`Could not accept the run invitation: HTTP ${accepted.status}`);

  const session = sessionFrom(accepted);
  return {
    id: session.user.id,
    email,
    password,
    invitationId: issued.body.invitation.id,
    invitationToken,
    acceptStatus: accepted.status,
    acceptBody: accepted.body,
    refreshToken: session.refreshToken,
  };
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const env = deployedApiEnv();
  await waitForApi();

  const [admin, manager, operator] = [
    await login(env.admin),
    await login(env.manager),
    await login(env.operator),
  ];
  const runUser = project.name === 'api' ? await createRunUser(admin.accessToken) : null;

  project.provide('adminToken', admin.accessToken);
  project.provide('managerToken', manager.accessToken);
  project.provide('operatorToken', operator.accessToken);
  project.provide('adminId', admin.user.id);
  project.provide('operatorId', operator.user.id);
  project.provide('ciProductId', await ensureCiProduct(admin.accessToken));
  project.provide('runUser', runUser);

  return async () => {
    if (!runUser) return;
    // The access token above may have expired during a long run.
    const { accessToken } = await login(env.admin);
    await call('PATCH', `/users/${runUser.id}`, {
      token: accessToken,
      body: { status: 'SUSPENDED' },
    });
  };
}
