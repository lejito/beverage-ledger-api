import { describe, expect, inject, it } from 'vitest';
import { CI_PRODUCT_NAME } from '../../support/global-setup';
import { call } from '../../support/http';
import { contractViolations } from '../../support/openapi';
import { FOREIGN_ID } from '../../support/session';

interface Producto {
  id: string;
  name: string;
  minimumStock: number | null;
  isActive: boolean;
}

/**
 * Regresión de API de RF-09 sobre el producto fijo de CI. Un producto no se
 * borra, así que nada aquí crea uno: se edita el fijo y se deja como estaba.
 */
describe('RF-09 - API de gestión de productos', () => {
  const admin = () => inject('adminToken');
  const id = () => inject('ciProductId');
  const buscar = (texto: string, estado = 'active') =>
    call<{ data: Producto[] }>(
      'GET',
      `/products?search=${encodeURIComponent(texto)}&status=${estado}`,
      {
        token: admin(),
      },
    );

  it('Caso 1 - la búsqueda cumple el contrato y encuentra el producto por su nombre', async () => {
    const respuesta = await buscar(CI_PRODUCT_NAME);

    expect(respuesta.status).toBe(200);
    expect(await contractViolations(respuesta.body, 'ProductPageDto')).toEqual([]);
    expect(respuesta.body.data.map((producto) => producto.id)).toContain(id());
  });

  it('Caso 2 - leer un producto por id cumple el contrato', async () => {
    const respuesta = await call<Producto>('GET', `/products/${id()}`, { token: admin() });

    expect(respuesta.status).toBe(200);
    expect(await contractViolations(respuesta.body, 'ProductDto')).toEqual([]);
  });

  it('Caso 3 - editar el stock mínimo lo aplica y se puede restaurar', async () => {
    const antes = await call<Producto>('GET', `/products/${id()}`, { token: admin() });
    const nuevoMinimo = (antes.body.minimumStock ?? 0) + 1;

    const editado = await call<Producto>('PATCH', `/products/${id()}`, {
      token: admin(),
      body: { minimumStock: nuevoMinimo },
    });
    const restaurado = await call<Producto>('PATCH', `/products/${id()}`, {
      token: admin(),
      body: { minimumStock: antes.body.minimumStock ?? 0 },
    });

    expect(editado.status).toBe(200);
    expect(editado.body.minimumStock).toBe(nuevoMinimo);
    expect(restaurado.status).toBe(200);
  });

  it('Caso 4 - desactivar lo saca del listado activo sin borrarlo, y reactivar lo devuelve', async () => {
    const desactivar = await call<Producto>('PATCH', `/products/${id()}`, {
      token: admin(),
      body: { isActive: false },
    });
    const activos = await buscar(CI_PRODUCT_NAME);
    const inactivos = await buscar(CI_PRODUCT_NAME, 'inactive');
    const reactivar = await call<Producto>('PATCH', `/products/${id()}`, {
      token: admin(),
      body: { isActive: true },
    });

    expect(desactivar.status).toBe(200);
    expect(desactivar.body.isActive).toBe(false);
    expect(activos.body.data.map((producto) => producto.id)).not.toContain(id());
    expect(inactivos.body.data.map((producto) => producto.id)).toContain(id());
    expect(reactivar.body.isActive).toBe(true);
  });

  it('Caso 5 - crear otro producto con el mismo nombre responde 409 y no lo crea', async () => {
    const actual = await call<Producto & { category: { id: string } }>('GET', `/products/${id()}`, {
      token: admin(),
    });

    const respuesta = await call('POST', '/products', {
      token: admin(),
      body: { name: CI_PRODUCT_NAME, categoryId: actual.body.category.id },
    });
    const conEseNombre = await buscar(CI_PRODUCT_NAME, 'all');

    expect(respuesta.status).toBe(409);
    expect(
      conEseNombre.body.data.filter((producto) => producto.name === CI_PRODUCT_NAME),
    ).toHaveLength(1);
  });

  it('Caso 6 - un id ajeno responde 404 y uno mal formado 400', async () => {
    const ajeno = await call('GET', `/products/${FOREIGN_ID}`, { token: admin() });
    const malFormado = await call('GET', '/products/no-es-un-uuid', { token: admin() });

    expect(ajeno.status).toBe(404);
    expect(malFormado.status).toBe(400);
  });

  // Pendiente · heurística 36: la búsqueda filtra por subcadena (`contains`) y no
  // tolera errores tipográficos. Se activa cuando la API ordene por similitud de
  // pg_trgm en vez de filtrar solo por coincidencia exacta.
  it.skip('Pendiente heurística 36 - la búsqueda tolera un error tipográfico', async () => {
    const respuesta = await buscar('[CI] Prodcto de prueba');

    expect(respuesta.body.data.map((producto) => producto.id)).toContain(id());
  });
});
