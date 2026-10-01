import { createHash } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole, UserStatus } from '../../src/generated/prisma/enums';
import { AuditAction, AuditEntity } from '../../src/modules/audit/audit.actions';
import type { AuditService } from '../../src/modules/audit/audit.service';
import type { PasswordService } from '../../src/modules/auth/password.service';
import type { AcceptInvitationDto } from '../../src/modules/invitations/dto/invitation.dto';
import { InvitationsService } from '../../src/modules/invitations/invitations.service';
import type { InvitationsRepository } from '../../src/modules/invitations/repositories/invitations.repository';

/**
 * Regresión de RF-03: lo que hace segura una invitación más allá de sus
 * caminos. El token nunca se consulta en claro, el rol lo fija quien invita y
 * una carrera perdida no deja ni miembro ni auditoría.
 */
describe('RF-03 - Regresión de aceptar una invitación', () => {
  const TOKEN = 'token-del-enlace';
  const INUTILIZABLE = 'This invitation link is no longer valid. Ask for a new one';

  const INVITACION = {
    id: 'inv-1',
    organizationId: 'org-1',
    organizationName: 'Bar La Esquina',
    email: 'ana@example.com',
    role: UserRole.OPERATOR,
    expiresAt: new Date('2026-10-15T00:00:00.000Z'),
  };

  const CREADO = {
    id: 'user-9',
    organizationId: 'org-1',
    email: 'ana@example.com',
    name: 'Ana Restrepo',
    role: UserRole.OPERATOR,
    avatarUrl: null,
    status: UserStatus.ACTIVE,
  };

  let invitations: InvitationsService;
  let findRedeemableByHash: ReturnType<typeof vi.fn>;
  let userExists: ReturnType<typeof vi.fn>;
  let markAccepted: ReturnType<typeof vi.fn>;
  let createUser: ReturnType<typeof vi.fn>;
  let runInTransaction: ReturnType<typeof vi.fn>;
  let hash: ReturnType<typeof vi.fn>;
  let record: ReturnType<typeof vi.fn>;

  const aceptar = (cambios: Partial<AcceptInvitationDto> = {}) =>
    invitations.accept({
      token: TOKEN,
      name: 'Ana Restrepo',
      password: 'Inventario2026!',
      ...cambios,
    });

  beforeEach(() => {
    findRedeemableByHash = vi.fn().mockResolvedValue(INVITACION);
    userExists = vi.fn().mockResolvedValue(false);
    markAccepted = vi.fn().mockResolvedValue(true);
    createUser = vi.fn().mockResolvedValue(CREADO);
    runInTransaction = vi
      .fn()
      .mockImplementation((callback: (tx: unknown) => unknown) => callback({}));
    hash = vi.fn().mockResolvedValue('hash-argon2');
    record = vi.fn();

    invitations = new InvitationsService(
      {
        findRedeemableByHash,
        userExists,
        markAccepted,
        createUser,
        runInTransaction,
      } as unknown as InvitationsRepository,
      { hash } as unknown as PasswordService,
      { record } as unknown as AuditService,
    );
  });

  it('Camino 1 - el token se busca por su huella SHA-256, nunca en claro', async () => {
    // Arrange
    const huella = createHash('sha256').update(TOKEN).digest('hex');

    // Act
    await aceptar();

    // Assert
    expect(findRedeemableByHash).toHaveBeenCalledWith(huella);
    expect(findRedeemableByHash).not.toHaveBeenCalledWith(TOKEN);
  });

  it('Camino 2 - el rol y la organización salen de la invitación, no del body', async () => {
    // Arrange
    const conRolInyectado = { role: UserRole.ORG_ADMIN, organizationId: 'org-ajena' };

    // Act
    await aceptar(conRolInyectado as Partial<AcceptInvitationDto>);

    // Assert
    expect(createUser).toHaveBeenCalledWith(
      {
        organizationId: 'org-1',
        email: 'ana@example.com',
        name: 'Ana Restrepo',
        passwordHash: 'hash-argon2',
        role: UserRole.OPERATOR,
      },
      expect.anything(),
    );
  });

  it('Camino 3 - la contraseña se guarda hasheada y el nombre sin espacios', async () => {
    // Act
    await aceptar({ name: '  Ana Restrepo  ' });

    // Assert
    expect(hash).toHaveBeenCalledWith('Inventario2026!');
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ana Restrepo', passwordHash: 'hash-argon2' }),
      expect.anything(),
    );
  });

  it('Camino 4 - un email que ya es miembro no llega a hashear ni a abrir transacción', async () => {
    // Arrange
    userExists.mockResolvedValue(true);

    // Act
    const resultado = aceptar();

    // Assert
    await expect(resultado).rejects.toThrow(ConflictException);
    expect(hash).not.toHaveBeenCalled();
    expect(runInTransaction).not.toHaveBeenCalled();
  });

  it('Camino 5 - perder la carrera no crea miembro ni deja auditoría', async () => {
    // Arrange
    markAccepted.mockResolvedValue(false);

    // Act
    const resultado = aceptar();

    // Assert
    await expect(resultado).rejects.toThrow(INUTILIZABLE);
    expect(createUser).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('Camino 6 - marcar la invitación y crear el miembro ocurren en la misma transacción', async () => {
    // Arrange
    const tx = { transaccion: 'tx-1' };
    runInTransaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(tx));

    // Act
    await aceptar();

    // Assert
    expect(markAccepted).toHaveBeenCalledWith('inv-1', tx);
    expect(createUser).toHaveBeenCalledWith(expect.anything(), tx);
  });

  it('Camino 7 - aceptar queda auditado a nombre del miembro creado', async () => {
    // Act
    await aceptar();

    // Assert
    expect(record).toHaveBeenCalledWith({
      action: AuditAction.InvitationAccepted,
      entity: AuditEntity.Invitation,
      entityId: 'inv-1',
      organizationId: 'org-1',
      userId: 'user-9',
      metadata: { email: 'ana@example.com', role: UserRole.OPERATOR },
    });
  });

  it('Camino 8 - la vista previa expone solo lo necesario para la pantalla de aceptar', async () => {
    // Act
    const vista = await invitations.preview(TOKEN);

    // Assert
    expect(vista).toEqual({
      email: 'ana@example.com',
      role: UserRole.OPERATOR,
      organizationName: 'Bar La Esquina',
      expiresAt: INVITACION.expiresAt,
    });
  });

  it('Camino 9 - vista previa y aceptación rechazan un token inútil con el mismo mensaje', async () => {
    // Arrange
    findRedeemableByHash.mockResolvedValue(null);

    // Act
    const vista = invitations.preview(TOKEN);
    const aceptacion = aceptar();

    // Assert
    await expect(vista).rejects.toThrow(NotFoundException);
    await expect(vista).rejects.toThrow(INUTILIZABLE);
    await expect(aceptacion).rejects.toThrow(NotFoundException);
    await expect(aceptacion).rejects.toThrow(INUTILIZABLE);
  });
});
