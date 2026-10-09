import { describe, expect, inject, it } from 'vitest';
import { call } from '../../support/http';

/** Regresión de seguridad de RF-03. Ninguna petición de aquí llega a crear nada. */
describe('RF-03 - Seguridad de las invitaciones', () => {
  it('Caso 1 - un administrador no puede invitar a alguien como PLATFORM_ADMIN', async () => {
    const respuesta = await call('POST', '/invitations', {
      token: inject('adminToken'),
      body: { email: `ci-escalada+${Date.now()}@beverageledger.test`, role: 'PLATFORM_ADMIN' },
    });

    expect(respuesta.status).toBe(403);
  });

  it('Caso 2 - un token inventado no revela nada y responde 404', async () => {
    const respuesta = await call('POST', '/invitations/lookup', {
      body: { token: 'a'.repeat(43) },
    });

    expect(respuesta.status).toBe(404);
  });

  it('Caso 3 - el token solo se acepta en el body, nunca en la URL', async () => {
    const respuesta = await call('POST', `/invitations/lookup?token=${'a'.repeat(43)}`, {
      body: {},
    });

    expect(respuesta.status).toBe(400);
  });

  it('Caso 4 - aceptar con un campo que el DTO no declara (rol) responde 400', async () => {
    const respuesta = await call('POST', '/invitations/accept', {
      body: {
        token: 'a'.repeat(43),
        name: 'Intruso',
        password: 'Intruso-Seguro-2026',
        role: 'ORG_ADMIN',
      },
    });

    expect(respuesta.status).toBe(400);
  });
});
