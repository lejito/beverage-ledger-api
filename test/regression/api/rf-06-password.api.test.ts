import { beforeAll, describe, expect, inject, it } from 'vitest';
import { call } from '../../support/http';
import { login, strongPassword, type Session } from '../../support/session';

/**
 * Regresión de API de RF-06 sobre el usuario de la corrida: es el único al que
 * se le puede cambiar la contraseña sin dejar inservible una cuenta fija de CI
 * si la prueba falla a mitad de camino.
 */
describe('RF-06 - API de cambio de contraseña', () => {
  const usuario = () => inject('runUser')!;
  const nuevaContrasena = strongPassword();
  let sesion: Session;

  beforeAll(async () => {
    sesion = await login({ email: usuario().email, password: usuario().password });
  });

  it('Caso 1 - una contraseña que no cumple la política responde 400 y dice qué falta', async () => {
    const respuesta = await call<{ message: string[] }>('PUT', '/users/me/password', {
      token: sesion.accessToken,
      body: { currentPassword: usuario().password, newPassword: 'corta' },
    });

    expect(respuesta.status).toBe(400);
    // Heurística 35: el mensaje tiene que decir qué introducir, no solo que está mal.
    expect(respuesta.body.message.join(' ')).toMatch(/12/);
  });

  it('Caso 2 - con la contraseña actual correcta el cambio responde 204', async () => {
    const respuesta = await call('PUT', '/users/me/password', {
      token: sesion.accessToken,
      body: { currentPassword: usuario().password, newPassword: nuevaContrasena },
    });

    expect(respuesta.status).toBe(204);
  });

  it('Caso 3 - el cambio cierra las sesiones abiertas: el refresh anterior ya no sirve', async () => {
    const respuesta = await call('POST', '/auth/refresh', { refreshToken: sesion.refreshToken });

    expect(respuesta.status).toBe(401);
  });

  it('Caso 4 - la contraseña anterior deja de entrar y la nueva entra', async () => {
    const anterior = await call('POST', '/auth/login', {
      body: { email: usuario().email, password: usuario().password },
    });
    const nueva = await call('POST', '/auth/login', {
      body: { email: usuario().email, password: nuevaContrasena },
    });

    expect(anterior.status).toBe(401);
    expect(nueva.status).toBe(200);
  });
});
