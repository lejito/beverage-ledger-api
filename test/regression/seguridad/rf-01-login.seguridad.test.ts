import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, inject, it } from 'vitest';
import { deployedApiEnv } from '../../support/env';
import { call, spendAuthBudget } from '../../support/http';
import { login, sessionFrom, type SessionBody } from '../../support/session';

const base64url = (valor: object | string) =>
  Buffer.from(typeof valor === 'string' ? valor : JSON.stringify(valor)).toString('base64url');

function partes(token: string) {
  const [cabecera, carga, firma] = token.split('.');
  const decodificada = JSON.parse(Buffer.from(carga!, 'base64url').toString()) as Record<
    string,
    unknown
  >;
  return { cabecera: cabecera!, carga: decodificada, firma: firma! };
}

/**
 * Regresión de seguridad de RF-01. La cuenta CI_LOCKOUT existe solo para quedar
 * bloqueada aquí. La prueba del 429 marca como gastado el presupuesto del login,
 * así que la siguiente llamada a esa ruta espera a que el límite se reinicie.
 */
describe('RF-01 - Seguridad del inicio de sesión', () => {
  const { lockout } = deployedApiEnv();
  const operador = () => inject('operatorToken');

  it('Caso 1 - un token con la carga alterada responde 401', async () => {
    const { cabecera, carga, firma } = partes(operador());
    const alterado = `${cabecera}.${base64url({ ...carga, role: 'ORG_ADMIN' })}.${firma}`;

    const respuesta = await call('GET', '/auth/me', { token: alterado });

    expect(respuesta.status).toBe(401);
  });

  it('Caso 2 - un token sin firma (alg: none) responde 401', async () => {
    const { carga } = partes(operador());
    const sinFirma = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(carga)}.`;

    const respuesta = await call('GET', '/auth/me', { token: sinFirma });

    expect(respuesta.status).toBe(401);
  });

  it('Caso 3 - un token firmado con otro secreto responde 401', async () => {
    const { carga } = partes(operador());
    const cabecera = base64url({ alg: 'HS256', typ: 'JWT' });
    const cuerpo = base64url(carga);
    const firma = createHmac('sha256', randomBytes(48))
      .update(`${cabecera}.${cuerpo}`)
      .digest('base64url');

    const respuesta = await call('GET', '/auth/me', { token: `${cabecera}.${cuerpo}.${firma}` });

    expect(respuesta.status).toBe(401);
  });

  it('Caso 4 - email inexistente y contraseña errónea responden igual: no se enumeran cuentas', async () => {
    const inexistente = await call<{ message: string }>('POST', '/auth/login', {
      body: { email: 'nadie+ci@beverageledger.test', password: 'NoExiste-2026' },
    });
    const erronea = await call<{ message: string }>('POST', '/auth/login', {
      body: { email: lockout.email, password: 'Erronea-2026-ci' },
    });

    expect(inexistente.status).toBe(401);
    expect(erronea.status).toBe(401);
    expect(erronea.body.message).toBe(inexistente.body.message);
  });

  it('Caso 5 - tras los intentos fallidos la cuenta se bloquea y ni la contraseña correcta entra', async () => {
    for (let intento = 0; intento < 5; intento++) {
      await call('POST', '/auth/login', {
        body: { email: lockout.email, password: `Erronea-${intento}-ci-2026` },
      });
    }

    const correcta = await call<{ message: string }>('POST', '/auth/login', { body: lockout });

    expect(correcta.status).toBe(401);
  });

  it('Caso 6 - reusar un refresh ya rotado responde 401', async () => {
    const sesion = await login(deployedApiEnv().operator);
    const rotado = await call<SessionBody>('POST', '/auth/refresh', {
      refreshToken: sesion.refreshToken,
    });

    const reuso = await call('POST', '/auth/refresh', { refreshToken: sesion.refreshToken });

    expect(rotado.status).toBe(200);
    expect(sessionFrom(rotado).refreshToken).not.toBe(sesion.refreshToken);
    expect(reuso.status).toBe(401);
  });

  it('Caso 7 - superar el límite de intentos de login responde 429', async () => {
    const intentos = await Promise.all(
      Array.from({ length: 12 }, () =>
        call('POST', '/auth/login', {
          body: { email: 'nadie+ci@beverageledger.test', password: 'NoExiste-2026' },
          unthrottled: true,
        }),
      ),
    );
    spendAuthBudget('/auth/login');

    expect(intentos.map((intento) => intento.status)).toContain(429);
  });
});
