import { describe, expect, inject, it } from 'vitest';
import { call } from '../../support/http';

/**
 * Regresión de seguridad de RF-06 sobre la cuenta fija de operador. Todas las
 * peticiones se rechazan, así que su contraseña nunca cambia.
 */
describe('RF-06 - Seguridad del cambio de contraseña', () => {
  const operador = () => inject('operatorToken');

  it('Caso 1 - sin sesión responde 401', async () => {
    const respuesta = await call('PUT', '/users/me/password', {
      body: { currentPassword: 'Cualquiera-2026', newPassword: 'Nueva-Segura-2026' },
    });

    expect(respuesta.status).toBe(401);
  });

  it('Caso 2 - sin la contraseña actual responde 400: un token robado no basta', async () => {
    const respuesta = await call('PUT', '/users/me/password', {
      token: operador(),
      body: { newPassword: 'Nueva-Segura-2026' },
    });

    expect(respuesta.status).toBe(400);
  });

  it('Caso 3 - con una contraseña actual incorrecta responde 400, no 401: la sesión sigue siendo válida', async () => {
    const respuesta = await call('PUT', '/users/me/password', {
      token: operador(),
      body: { currentPassword: 'No-Es-La-Actual-2026', newPassword: 'Nueva-Segura-2026' },
    });

    expect(respuesta.status).toBe(400);
  });

  it('Caso 4 - un campo que el DTO no declara (otro usuario) responde 400', async () => {
    const respuesta = await call('PUT', '/users/me/password', {
      token: operador(),
      body: { userId: inject('adminId'), newPassword: 'Nueva-Segura-2026' },
    });

    expect(respuesta.status).toBe(400);
  });
});
