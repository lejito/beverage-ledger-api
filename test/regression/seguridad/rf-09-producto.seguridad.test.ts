import { describe, expect, inject, it } from 'vitest';
import { call } from '../../support/http';

/** Regresión de seguridad de RF-09. Los permisos por rol están en la matriz. */
describe('RF-09 - Seguridad de la gestión de productos', () => {
  const admin = () => inject('adminToken');
  const id = () => inject('ciProductId');

  it('Caso 1 - mover un producto a otra organización (organizationId) responde 400', async () => {
    const respuesta = await call('PATCH', `/products/${id()}`, {
      token: admin(),
      body: { organizationId: '00000000-0000-4000-8000-000000000000' },
    });

    expect(respuesta.status).toBe(400);
  });

  it('Caso 2 - un id que no es UUID se rechaza antes de llegar a la base de datos', async () => {
    const respuesta = await call<{ message: string }>('GET', "/products/1' OR '1'='1", {
      token: admin(),
    });

    expect(respuesta.status).toBe(400);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/prisma|sql|select|stack/i);
  });

  it('Caso 3 - la búsqueda trata la entrada como texto: una inyección no altera el resultado', async () => {
    const respuesta = await call<{ data: unknown[] }>(
      'GET',
      `/products?search=${encodeURIComponent("' OR 1=1 --")}`,
      {
        token: admin(),
      },
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([]);
  });
});
