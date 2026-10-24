import { beforeAll, describe, expect, inject, it } from 'vitest';
import { ROLE_PERMISSIONS } from '../../../src/common/permissions/permissions.config';
import { deployedApiEnv } from '../../support/env';
import { call, REFRESH_COOKIE } from '../../support/http';
import { contractViolations } from '../../support/openapi';
import { sessionFrom, type Session, type SessionBody } from '../../support/session';

/**
 * Regresión de API de RF-01 contra la API desplegada: el contrato de la sesión,
 * la cookie de refresh, su rotación y el cierre de sesión.
 */
describe('RF-01 - API de inicio de sesión', () => {
  let respuestaLogin: Awaited<ReturnType<typeof call<SessionBody>>>;
  let sesion: Session;

  beforeAll(async () => {
    respuestaLogin = await call<SessionBody>('POST', '/auth/login', {
      body: deployedApiEnv().operator,
    });
    sesion = sessionFrom(respuestaLogin);
  });

  it('Caso 1 - un login correcto responde 200 con la sesión que declara el contrato', async () => {
    expect(respuestaLogin.status).toBe(200);
    expect(await contractViolations(respuestaLogin.body, 'SessionDto')).toEqual([]);
    expect(respuestaLogin.body.user.role).toBe('OPERATOR');
  });

  it('Caso 2 - la cookie de refresh viaja httpOnly, Secure, SameSite=None y solo hacia /auth', () => {
    const cookie = respuestaLogin.headers
      .getSetCookie()
      .find((linea) => linea.startsWith(`${REFRESH_COOKIE}=`));

    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=None/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/i);
  });

  it('Caso 3 - /auth/me devuelve exactamente los permisos que la matriz da al rol', async () => {
    const respuesta = await call<{ permissions: string[] }>('GET', '/auth/me', {
      token: inject('operatorToken'),
    });

    expect(respuesta.status).toBe(200);
    expect(await contractViolations(respuesta.body, 'CurrentSessionDto')).toEqual([]);
    expect([...respuesta.body.permissions].sort()).toEqual([...ROLE_PERMISSIONS.OPERATOR].sort());
  });

  it('Caso 4 - renovar rota la cookie y entrega un token nuevo', async () => {
    const respuesta = await call<SessionBody>('POST', '/auth/refresh', {
      refreshToken: sesion.refreshToken,
    });

    expect(respuesta.status).toBe(200);
    expect(await contractViolations(respuesta.body, 'SessionDto')).toEqual([]);
    expect(respuesta.cookies[REFRESH_COOKIE]).toBeTruthy();
    expect(respuesta.cookies[REFRESH_COOKIE]).not.toBe(sesion.refreshToken);

    sesion = sessionFrom(respuesta);
  });

  it('Caso 5 - cerrar sesión responde 204, borra la cookie y la deja inservible', async () => {
    const salida = await call('POST', '/auth/logout', {
      token: sesion.accessToken,
      refreshToken: sesion.refreshToken,
    });
    const renovar = await call('POST', '/auth/refresh', { refreshToken: sesion.refreshToken });

    expect(salida.status).toBe(204);
    expect(salida.cookies[REFRESH_COOKIE]).toBe('');
    expect(renovar.status).toBe(401);
  });

  it('Caso 6 - un error responde con la forma uniforme del filtro global', async () => {
    const respuesta = await call<Record<string, unknown>>('POST', '/auth/login', {
      body: { email: 'nadie+ci@beverageledger.test', password: 'NoExiste-2026' },
    });

    expect(respuesta.status).toBe(401);
    expect(Object.keys(respuesta.body).sort()).toEqual([
      'code',
      'error',
      'message',
      'path',
      'statusCode',
      'timestamp',
    ]);
    expect(respuesta.body.statusCode).toBe(401);
  });
});
