import { describe, expect, inject, it } from 'vitest';
import { call } from '../../support/http';

/** Regresión de seguridad de RF-29: nadie se da más poder del que tiene. */
describe('RF-29 - Seguridad de la gestión de usuarios', () => {
  const admin = () => inject('adminToken');

  it('Caso 1 - un operador no puede darse otro rol desde su propio perfil', async () => {
    const respuesta = await call('PATCH', '/users/me', {
      token: inject('operatorToken'),
      body: { role: 'ORG_ADMIN' },
    });

    expect(respuesta.status).toBe(400);
  });

  it('Caso 2 - un administrador no puede asignar PLATFORM_ADMIN', async () => {
    const respuesta = await call('PATCH', `/users/${inject('operatorId')}`, {
      token: admin(),
      body: { role: 'PLATFORM_ADMIN' },
    });

    expect(respuesta.status).toBe(400);
  });

  it('Caso 3 - un administrador no puede suspenderse a sí mismo', async () => {
    const respuesta = await call('PATCH', `/users/${inject('adminId')}`, {
      token: admin(),
      body: { status: 'SUSPENDED' },
    });

    expect(respuesta.status).toBe(400);
  });

  it('Caso 4 - las respuestas de usuarios nunca exponen la contraseña ni su hash', async () => {
    const respuesta = await call('GET', '/users?pageSize=100', { token: admin() });

    expect(respuesta.status).toBe(200);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/password|hash|\$argon2/i);
  });
});
