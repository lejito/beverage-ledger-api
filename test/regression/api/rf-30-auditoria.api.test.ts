import { describe, expect, inject, it } from 'vitest';
import { call } from '../../support/http';
import { contractViolations } from '../../support/openapi';

interface Entrada {
  action: string;
  entityId: string | null;
  createdAt: string;
  user: { id: string };
}

interface PaginaDeAuditoria {
  data: Entrada[];
  meta: { total: number };
}

/** Regresión de API de RF-30: cada acción deja su rastro y el rastro se puede filtrar. */
describe('RF-30 - API de auditoría', () => {
  const admin = () => inject('adminToken');
  const auditoria = (consulta: string) =>
    call<PaginaDeAuditoria>('GET', `/audit-logs?${consulta}`, { token: admin() });

  it('Caso 1 - el listado cumple el contrato', async () => {
    const respuesta = await auditoria('pageSize=5');

    expect(respuesta.status).toBe(200);
    expect(await contractViolations(respuesta.body, 'AuditLogPageDto')).toEqual([]);
  });

  it('Caso 2 - editar un producto deja una entrada product.updated con su autor', async () => {
    const productoId = inject('ciProductId');
    const inicio = Date.now();
    const producto = await call<{ minimumStock: number | null }>('GET', `/products/${productoId}`, {
      token: admin(),
    });
    const minimo = producto.body.minimumStock ?? 0;
    await call('PATCH', `/products/${productoId}`, {
      token: admin(),
      body: { minimumStock: minimo + 1 },
    });
    await call('PATCH', `/products/${productoId}`, {
      token: admin(),
      body: { minimumStock: minimo },
    });

    const respuesta = await auditoria(
      `entity=product&entityId=${productoId}&action=product.updated&pageSize=1`,
    );
    const [ultima] = respuesta.body.data;

    expect(ultima?.user.id).toBe(inject('adminId'));
    expect(new Date(ultima!.createdAt).getTime()).toBeGreaterThanOrEqual(inicio - 60_000);
  });

  it('Caso 3 - aceptar la invitación de la corrida quedó registrado', async () => {
    const invitacionId = inject('runUser')!.invitationId;

    const respuesta = await auditoria(`action=invitation.accepted&entityId=${invitacionId}`);

    expect(respuesta.body.meta.total).toBe(1);
  });

  it('Caso 4 - un rango de fechas futuro no devuelve entradas', async () => {
    const respuesta = await auditoria('from=2999-01-01&to=2999-01-31');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.meta.total).toBe(0);
  });

  it('Caso 5 - un valor fuera del enum en el filtro responde 400', async () => {
    const respuesta = await auditoria('action=product.borrado');

    expect(respuesta.status).toBe(400);
  });
});
