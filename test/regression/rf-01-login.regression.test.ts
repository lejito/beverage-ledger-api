import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../src/config/configuration';
import { UserRole, UserStatus } from '../../src/generated/prisma/enums';
import { ROLE_PERMISSIONS } from '../../src/common/permissions/permissions.config';
import { AuditAction, AuditEntity } from '../../src/modules/audit/audit.actions';
import type { AuditService } from '../../src/modules/audit/audit.service';
import { CredentialsService } from '../../src/modules/auth/credentials.service';
import type { PasswordService } from '../../src/modules/auth/password.service';
import type { AuthRepository } from '../../src/modules/auth/repositories/auth.repository';

/**
 * Regresión de RF-01: las decisiones de seguridad del inicio de sesión que un
 * cambio podría deshacer sin que los caminos de rf-01-back lo noten, porque
 * esos solo miran el tipo de la excepción.
 */
describe('RF-01 - Regresión del inicio de sesión con credenciales', () => {
  const AHORA = new Date('2026-09-01T12:00:00.000Z');
  const CREDENCIALES_INVALIDAS = 'Invalid email or password';

  let auth: CredentialsService;
  let findByEmail: ReturnType<typeof vi.fn>;
  let markLoginSucceeded: ReturnType<typeof vi.fn>;
  let verify: ReturnType<typeof vi.fn>;
  let verifyDecoy: ReturnType<typeof vi.fn>;
  let record: ReturnType<typeof vi.fn>;

  const usuario = (cambios: Record<string, unknown> = {}) => ({
    id: 'user-1',
    organizationId: 'org-1',
    email: 'ana@example.com',
    name: 'Ana Restrepo',
    role: UserRole.MANAGER,
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    passwordHash: 'hash',
    lockedUntil: null,
    failedLoginAttempts: 0,
    ...cambios,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);

    findByEmail = vi.fn();
    markLoginSucceeded = vi.fn();
    verify = vi.fn();
    verifyDecoy = vi.fn();
    record = vi.fn();

    auth = new CredentialsService(
      {
        findByEmail,
        markLoginSucceeded,
        markLoginFailed: vi.fn(),
      } as unknown as AuthRepository,
      { verify, verifyDecoy } as unknown as PasswordService,
      { record } as unknown as AuditService,
      {
        get: vi.fn().mockReturnValue({ maxAttempts: 5, lockoutMinutes: 15 }),
      } as unknown as ConfigService<AppConfig, true>,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Camino 1 - el email se normaliza antes de buscar al usuario', async () => {
    // Arrange
    findByEmail.mockResolvedValue(usuario());
    verify.mockResolvedValue(true);

    // Act
    await auth.validateCredentials('  Ana@Example.COM ', 'clave');

    // Assert
    expect(findByEmail).toHaveBeenCalledWith('ana@example.com');
  });

  it('Camino 2 - email inexistente, contraseña errónea y cuenta bloqueada responden igual', async () => {
    // Arrange
    const bloqueado = usuario({ lockedUntil: new Date(AHORA.getTime() + 60_000) });
    findByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(usuario())
      .mockResolvedValueOnce(bloqueado);
    verify.mockResolvedValue(false);

    // Act
    const respuestas = await Promise.allSettled([
      auth.validateCredentials('nadie@example.com', 'clave'),
      auth.validateCredentials('ana@example.com', 'clave-errada'),
      auth.validateCredentials('ana@example.com', 'clave'),
    ]);

    // Assert
    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe('rejected');
      const motivo = (respuesta as PromiseRejectedResult).reason;
      expect(motivo).toBeInstanceOf(UnauthorizedException);
      expect(motivo.message).toBe(CREDENCIALES_INVALIDAS);
    }
  });

  it('Camino 3 - una cuenta suspendida con contraseña errónea no revela que está suspendida', async () => {
    // Arrange
    findByEmail.mockResolvedValue(usuario({ status: UserStatus.SUSPENDED }));
    verify.mockResolvedValue(false);

    // Act
    const resultado = auth.validateCredentials('ana@example.com', 'clave-errada');

    // Assert
    await expect(resultado).rejects.toThrow(CREDENCIALES_INVALIDAS);
  });

  it('Camino 4 - una cuenta suspendida con contraseña correcta recibe el motivo real', async () => {
    // Arrange
    findByEmail.mockResolvedValue(usuario({ status: UserStatus.SUSPENDED }));
    verify.mockResolvedValue(true);

    // Act
    const resultado = auth.validateCredentials('ana@example.com', 'clave');

    // Assert
    await expect(resultado).rejects.toThrow(/suspended/);
    expect(markLoginSucceeded).not.toHaveBeenCalled();
  });

  it('Camino 5 - un bloqueo ya vencido no impide entrar', async () => {
    // Arrange
    findByEmail.mockResolvedValue(usuario({ lockedUntil: new Date(AHORA.getTime() - 60_000) }));
    verify.mockResolvedValue(true);

    // Act
    const resultado = await auth.validateCredentials('ana@example.com', 'clave');

    // Assert
    expect(resultado.id).toBe('user-1');
    expect(verifyDecoy).not.toHaveBeenCalled();
  });

  it('Camino 6 - un ingreso exitoso marca el login, lo audita y devuelve los permisos del rol', async () => {
    // Arrange
    findByEmail.mockResolvedValue(usuario());
    verify.mockResolvedValue(true);

    // Act
    const resultado = await auth.validateCredentials('ana@example.com', 'clave');

    // Assert
    expect(markLoginSucceeded).toHaveBeenCalledWith('user-1');
    expect(record).toHaveBeenCalledWith({
      action: AuditAction.UserSignedIn,
      entity: AuditEntity.User,
      entityId: 'user-1',
      organizationId: 'org-1',
      userId: 'user-1',
      metadata: { method: 'password' },
    });
    expect(resultado.permissions).toEqual(ROLE_PERMISSIONS[UserRole.MANAGER]);
    expect(resultado).not.toHaveProperty('passwordHash');
  });

  it('Camino 7 - un intento con contraseña errónea queda auditado con su causa', async () => {
    // Arrange
    findByEmail.mockResolvedValue(usuario());
    verify.mockResolvedValue(false);

    // Act
    await auth.validateCredentials('ana@example.com', 'clave-errada').catch(() => undefined);

    // Assert
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UserSignInFailed,
        metadata: { cause: 'bad-password' },
      }),
    );
  });

  it('Camino 8 - un email inexistente no deja entrada de auditoría', async () => {
    // Arrange
    findByEmail.mockResolvedValue(null);

    // Act
    await auth.validateCredentials('nadie@example.com', 'clave').catch(() => undefined);

    // Assert
    expect(verifyDecoy).toHaveBeenCalledWith('clave');
    expect(record).not.toHaveBeenCalled();
  });
});
