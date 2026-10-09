import { describe, expect, inject, it } from 'vitest';
import { call } from '../../support/http';
import { contractViolations } from '../../support/openapi';
import { FOREIGN_ID } from '../../support/session';

interface Usuario {
  id: string;
  role: string;
  status: string;
}

interface PaginaDeUsuarios {
  data: Usuario[];
  meta: { page: number; pageSize: number; count: number };
}

/** Regresión de API de RF-29. Los cambios de rol se hacen sobre el usuario de la corrida. */
describe('RF-29 - API de gestión de usuarios', () => {
  const admin = () => inject('adminToken');
  const idDeLaCorrida = () => inject('runUser')!.id;

  it('Caso 1 - el listado está paginado en el servidor y cumple el contrato', async () => {
    const respuesta = await call<PaginaDeUsuarios>('GET', '/users?page=1&pageSize=5', {
      token: admin(),
    });

    expect(respuesta.status).toBe(200);
    expect(await contractViolations(respuesta.body, 'UserPageDto')).toEqual([]);
    expect(respuesta.body.meta).toMatchObject({ page: 1, pageSize: 5 });
    expect(respuesta.body.data.length).toBeLessThanOrEqual(5);
  });

  it('Caso 2 - un tamaño de página fuera de rango responde 400', async () => {
    const respuesta = await call('GET', '/users?pageSize=500', { token: admin() });

    expect(respuesta.status).toBe(400);
  });

  it('Caso 3 - leer un miembro por id cumple el contrato', async () => {
    const respuesta = await call<Usuario>('GET', `/users/${idDeLaCorrida()}`, { token: admin() });

    expect(respuesta.status).toBe(200);
    expect(await contractViolations(respuesta.body, 'UserDto')).toEqual([]);
  });

  it('Caso 4 - cambiar el rol de un miembro lo aplica y se puede revertir', async () => {
    const ascender = await call<Usuario>('PATCH', `/users/${idDeLaCorrida()}`, {
      token: admin(),
      body: { role: 'MANAGER' },
    });
    const revertir = await call<Usuario>('PATCH', `/users/${idDeLaCorrida()}`, {
      token: admin(),
      body: { role: 'OPERATOR' },
    });

    expect(ascender.status).toBe(200);
    expect(ascender.body.role).toBe('MANAGER');
    expect(revertir.body.role).toBe('OPERATOR');
  });

  it('Caso 5 - un administrador no puede cambiar su propio rol', async () => {
    const respuesta = await call('PATCH', `/users/${inject('adminId')}`, {
      token: admin(),
      body: { role: 'MANAGER' },
    });

    expect(respuesta.status).toBe(400);
  });

  it('Caso 6 - un id que no es de la organización responde 404', async () => {
    const respuesta = await call('GET', `/users/${FOREIGN_ID}`, { token: admin() });

    expect(respuesta.status).toBe(404);
  });
});
