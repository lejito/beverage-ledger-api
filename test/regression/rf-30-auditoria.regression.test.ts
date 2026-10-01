import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { TenantContextService } from '../../src/common/tenant/tenant-context.service';
import type { PrismaTransaction } from '../../src/infra/prisma/transaction';
import { AuditAction, AuditEntity } from '../../src/modules/audit/audit.actions';
import { AuditService } from '../../src/modules/audit/audit.service';
import type { AuditRepository } from '../../src/modules/audit/repositories/audit.repository';

/**
 * Regresión de RF-30: el contrato de AuditService. rf-30-back prueba los
 * filtros del repositorio; aquí se fija que `record` no tumba la acción que
 * describe, que `recordIn` sí propaga, y de dónde sale cada campo de la fila.
 */
describe('RF-30 - Regresión del registro de auditoría', () => {
  let service: AuditService;
  let insert: ReturnType<typeof vi.fn>;
  let findPage: ReturnType<typeof vi.fn>;
  let peek: ReturnType<typeof vi.fn>;
  let organizationId: Mock<() => string>;

  beforeEach(() => {
    insert = vi.fn();
    findPage = vi.fn();
    peek = vi.fn().mockReturnValue({ organizationId: 'org-1', userId: 'user-1' });
    organizationId = vi.fn<() => string>().mockReturnValue('org-1');

    const tenant = {
      peek,
      get organizationId() {
        return organizationId();
      },
      ipAddress: '203.0.113.7',
    } as unknown as TenantContextService;

    // The service logs the swallowed failure; silenced so the run stays readable.
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    service = new AuditService({ insert, findPage } as unknown as AuditRepository, tenant);
  });

  it('Camino 1 - un fallo al escribir no tumba la acción auditada', async () => {
    // Arrange
    insert.mockRejectedValue(new Error('connection reset'));

    // Act
    const resultado = service.record({
      action: AuditAction.UserSignedIn,
      entity: AuditEntity.User,
    });

    // Assert
    await expect(resultado).resolves.toBeUndefined();
  });

  it('Camino 2 - dentro de una transacción, el fallo sí se propaga', async () => {
    // Arrange
    const tx = {} as PrismaTransaction;
    insert.mockRejectedValue(new Error('connection reset'));

    // Act
    const resultado = service.recordIn(tx, {
      action: AuditAction.MovementConfirmed,
      entity: AuditEntity.Movement,
      entityId: 'mov-1',
    });

    // Assert
    await expect(resultado).rejects.toThrow('connection reset');
    expect(insert).toHaveBeenCalledWith(expect.anything(), tx);
  });

  it('Camino 3 - organización, usuario e IP salen del contexto de la petición', async () => {
    // Act
    await service.record({
      action: AuditAction.ProductCreated,
      entity: AuditEntity.Product,
      entityId: 'product-1',
      metadata: { name: 'Havana Club 7' },
    });

    // Assert
    expect(insert).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      action: AuditAction.ProductCreated,
      entity: AuditEntity.Product,
      entityId: 'product-1',
      metadata: { name: 'Havana Club 7' },
      ipAddress: '203.0.113.7',
    });
  });

  it('Camino 4 - en una ruta pública, la organización explícita evita exigir contexto', async () => {
    // Arrange
    peek.mockReturnValue(undefined);
    organizationId.mockImplementation(() => {
      throw new Error('No tenant context in this request.');
    });

    // Act
    await service.record({
      action: AuditAction.UserSignInFailed,
      entity: AuditEntity.User,
      organizationId: 'org-2',
      userId: 'user-7',
    });

    // Assert
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-2', userId: 'user-7' }),
    );
  });

  it('Camino 5 - un userId null explícito no se reemplaza por el de la sesión', async () => {
    // Act
    await service.record({
      action: AuditAction.OrganizationUpdated,
      entity: AuditEntity.Organization,
      userId: null,
    });

    // Assert
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it('Camino 6 - sin entidad ni metadata, la fila guarda null y un objeto vacío', async () => {
    // Act
    await service.record({ action: AuditAction.UserUpdated, entity: AuditEntity.User });

    // Assert
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ entityId: null, metadata: {} }));
  });

  it('Camino 7 - el listado pagina en el servidor y pasa los filtros al repositorio', async () => {
    // Arrange
    const desde = new Date('2026-08-01T00:00:00.000Z');
    findPage.mockResolvedValue({
      rows: [{ id: 'log-1', action: 'user.signed-in', entity: 'user' }],
      total: 51,
    });

    // Act
    const pagina = await service.list({
      page: 2,
      pageSize: 25,
      entity: AuditEntity.User,
      from: desde,
    });

    // Assert
    expect(findPage).toHaveBeenCalledWith(25, 25, {
      entity: AuditEntity.User,
      entityId: undefined,
      action: undefined,
      userId: undefined,
      from: desde,
      to: undefined,
    });
    expect(pagina.meta).toEqual({ page: 2, pageSize: 25, total: 51, pageCount: 3, count: 1 });
  });
});
