import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole, UserStatus } from '../../src/generated/prisma/enums';
import { AuditAction, AuditEntity } from '../../src/modules/audit/audit.actions';
import type { AuditService } from '../../src/modules/audit/audit.service';
import type { TokenService } from '../../src/modules/auth/token.service';
import type { UsersRepository } from '../../src/modules/users/repositories/users.repository';
import { UsersService } from '../../src/modules/users/users.service';

/**
 * Regresión de RF-29: la administración de miembros. rf-29-back cubre los
 * rechazos de update; aquí se fija que PLATFORM_ADMIN no se reparte, que solo
 * el último admin activo está protegido, qué cambios cortan sesiones y que el
 * directorio pagina en el servidor.
 */
describe('RF-29 - Regresión de la administración de usuarios', () => {
  const ADMIN = { id: 'admin-1', role: UserRole.ORG_ADMIN, status: UserStatus.ACTIVE };
  const OPERADOR = { id: 'user-2', role: UserRole.OPERATOR, status: UserStatus.ACTIVE };

  let service: UsersService;
  let findById: ReturnType<typeof vi.fn>;
  let findPage: ReturnType<typeof vi.fn>;
  let countAdmins: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let revokeAllForUser: ReturnType<typeof vi.fn>;
  let record: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findById = vi.fn().mockResolvedValue(OPERADOR);
    findPage = vi.fn();
    countAdmins = vi.fn().mockResolvedValue(1);
    update = vi.fn();
    revokeAllForUser = vi.fn();
    record = vi.fn();

    service = new UsersService(
      { findById, findPage, countAdmins, update } as unknown as UsersRepository,
      { revokeAllForUser } as unknown as TokenService,
      { record } as unknown as AuditService,
    );
  });

  it('Camino 1 - un ORG_ADMIN no puede repartir PLATFORM_ADMIN', async () => {
    // Act
    const resultado = service.update('admin-1', 'user-2', { role: UserRole.PLATFORM_ADMIN });

    // Assert
    await expect(resultado).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('Camino 2 - con otro admin activo, sí se puede degradar a un admin', async () => {
    // Arrange
    findById.mockResolvedValue({ ...ADMIN, id: 'admin-2' });
    countAdmins.mockResolvedValue(2);

    // Act
    await service.update('admin-1', 'admin-2', { role: UserRole.MANAGER });

    // Assert
    expect(update).toHaveBeenCalledWith('admin-2', { role: UserRole.MANAGER });
  });

  it('Camino 3 - degradar a un admin ya suspendido no consulta el conteo de admins', async () => {
    // Arrange
    findById.mockResolvedValue({ ...ADMIN, id: 'admin-2', status: UserStatus.SUSPENDED });

    // Act
    await service.update('admin-1', 'admin-2', { role: UserRole.OPERATOR });

    // Assert
    expect(countAdmins).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  it('Camino 4 - cambiar solo el rol no corta las sesiones del usuario', async () => {
    // Act
    await service.update('admin-1', 'user-2', { role: UserRole.MANAGER });

    // Assert
    expect(revokeAllForUser).not.toHaveBeenCalled();
  });

  it('Camino 5 - reactivar a un usuario no corta sesiones', async () => {
    // Arrange
    findById.mockResolvedValue({ ...OPERADOR, status: UserStatus.SUSPENDED });

    // Act
    await service.update('admin-1', 'user-2', { status: UserStatus.ACTIVE });

    // Assert
    expect(revokeAllForUser).not.toHaveBeenCalled();
  });

  it('Camino 6 - un cambio de rol deja en la auditoría el rol anterior y el nuevo', async () => {
    // Act
    await service.update('admin-1', 'user-2', { role: UserRole.MANAGER });

    // Assert
    expect(record).toHaveBeenCalledWith({
      action: AuditAction.UserUpdated,
      entity: AuditEntity.User,
      entityId: 'user-2',
      metadata: {
        roleFrom: UserRole.OPERATOR,
        roleTo: UserRole.MANAGER,
        statusFrom: undefined,
        statusTo: undefined,
        nameChanged: false,
      },
    });
  });

  it('Camino 7 - consultar un usuario de otra organización responde 404, no 403', async () => {
    // Arrange
    findById.mockResolvedValue(null);

    // Act
    const resultado = service.findOne('user-ajeno');

    // Assert
    await expect(resultado).rejects.toThrow(NotFoundException);
  });

  it('Camino 8 - el directorio pagina en el servidor', async () => {
    // Arrange
    findPage.mockResolvedValue({ rows: [OPERADOR], total: 41 });

    // Act
    const pagina = await service.list({ page: 3, pageSize: 20 });

    // Assert
    expect(findPage).toHaveBeenCalledWith(40, 20);
    expect(pagina.meta).toEqual({ page: 3, pageSize: 20, total: 41, pageCount: 3, count: 1 });
  });

  it('Camino 9 - un directorio vacío sigue siendo una página', async () => {
    // Arrange
    findPage.mockResolvedValue({ rows: [], total: 0 });

    // Act
    const pagina = await service.list({ page: 1, pageSize: 25 });

    // Assert
    expect(pagina.meta.pageCount).toBe(1);
    expect(pagina.data).toEqual([]);
  });
});
