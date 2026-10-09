import { describe, expect, inject, it } from 'vitest';
import { call, type ApiResponse } from '../../support/http';

/**
 * Render's edge (Cloudflare) answers 403 with an HTML "Blocked" page to anything
 * that looks like SQL injection, before the request reaches the API. That is a
 * rejection too, so these cases accept either layer: the edge blocking it, or
 * the API itself answering as it should when the request gets through.
 */
const blockedAtTheEdge = (respuesta: ApiResponse) =>
  respuesta.status === 403 &&
  respuesta.headers.get('server') === 'cloudflare' &&
  typeof respuesta.body === 'string' &&
  respuesta.body.includes('Blocked');

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

  it('Caso 2 - un id con inyección SQL se rechaza antes de llegar a la base de datos', async () => {
    const respuesta = await call<{ message: string }>('GET', "/products/1' OR '1'='1", {
      token: admin(),
    });

    // The edge's own block page talks about SQL: only the API's answer is checked for leaks.
    if (!blockedAtTheEdge(respuesta)) {
      expect(respuesta.status).toBe(400);
      expect(JSON.stringify(respuesta.body)).not.toMatch(/prisma|sql|select|stack/i);
    }
  });

  it('Caso 3 - una búsqueda con inyección SQL no altera el resultado', async () => {
    const respuesta = await call<{ data: unknown[] }>(
      'GET',
      `/products?search=${encodeURIComponent("' OR 1=1 --")}`,
      {
        token: admin(),
      },
    );

    if (!blockedAtTheEdge(respuesta)) {
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data).toEqual([]);
    }
  });
});
