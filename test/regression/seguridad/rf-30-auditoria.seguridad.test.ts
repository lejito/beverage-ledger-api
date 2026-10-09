import { randomBytes } from 'node:crypto';
import { describe, expect, inject, it } from 'vitest';
import { deployedApiEnv } from '../../support/env';
import { call } from '../../support/http';

/** Regresión de seguridad de RF-30: la auditoría registra los intentos sin guardar secretos. */
describe('RF-30 - Seguridad de la auditoría', () => {
  it('Caso 1 - un login fallido queda auditado sin la contraseña que se intentó', async () => {
    const intentada = `Secreto-${randomBytes(6).toString('hex')}`;
    await call('POST', '/auth/login', {
      body: { email: deployedApiEnv().lockout.email, password: intentada },
    });

    const respuesta = await call<{ data: unknown[] }>(
      'GET',
      '/audit-logs?action=user.sign-in-failed&pageSize=20',
      {
        token: inject('adminToken'),
      },
    );

    expect(respuesta.body.data.length).toBeGreaterThan(0);
    expect(JSON.stringify(respuesta.body)).not.toContain(intentada);
  });

  it('Caso 2 - filtrar con un userId que no es UUID responde 400', async () => {
    const respuesta = await call('GET', "/audit-logs?userId=1' OR '1'='1", {
      token: inject('adminToken'),
    });

    expect(respuesta.status).toBe(400);
  });
});
