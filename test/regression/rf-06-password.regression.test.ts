import { UnauthorizedException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../src/modules/audit/audit.service';
import type { PasswordService } from '../../src/modules/auth/password.service';
import type { AuthRepository } from '../../src/modules/auth/repositories/auth.repository';
import type { TokenService } from '../../src/modules/auth/token.service';
import { ChangePasswordDto } from '../../src/modules/users/dto/user.dto';
import { ProfileService } from '../../src/modules/users/profile.service';
import type { UsersRepository } from '../../src/modules/users/repositories/users.repository';
import type { UsersService } from '../../src/modules/users/users.service';

const REGLA_DE_CLASES =
  'The password must contain a lowercase letter, an uppercase letter and a digit';

const erroresDe = async (newPassword: unknown) => {
  const dto = plainToInstance(ChangePasswordDto, {
    currentPassword: 'Actual2026!abc',
    newPassword,
  });
  const errores = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errores.find((error) => error.property === 'newPassword')?.constraints ?? {};
};

/**
 * Regresión de RF-06: el orden de los efectos del cambio de contraseña y la
 * política que valida la nueva. rf-06-back recorre los caminos del service;
 * aquí se fija lo que pasaría desapercibido si se reordena o se relaja.
 */
describe('RF-06 - Regresión del cambio de contraseña', () => {
  let service: ProfileService;
  let findById: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let verify: ReturnType<typeof vi.fn>;
  let hash: ReturnType<typeof vi.fn>;
  let revokeAllForUser: ReturnType<typeof vi.fn>;
  let record: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findById = vi.fn().mockResolvedValue({ id: 'user-1', passwordHash: 'hash-actual' });
    update = vi.fn();
    verify = vi.fn().mockResolvedValue(true);
    hash = vi.fn().mockResolvedValue('hash-nuevo');
    revokeAllForUser = vi.fn();
    record = vi.fn();

    service = new ProfileService(
      { update } as unknown as UsersRepository,
      { findById } as unknown as AuthRepository,
      { verify, hash } as unknown as PasswordService,
      { revokeAllForUser } as unknown as TokenService,
      { record } as unknown as AuditService,
      {} as unknown as UsersService,
    );
  });

  it('Camino 1 - nunca se guarda la contraseña en claro', async () => {
    // Act
    await service.changePassword('user-1', {
      currentPassword: 'Actual2026!abc',
      newPassword: 'Nueva2026!abcd',
    });

    // Assert
    expect(hash).toHaveBeenCalledWith('Nueva2026!abcd');
    expect(update).toHaveBeenCalledWith('user-1', { passwordHash: 'hash-nuevo' });
  });

  it('Camino 2 - las sesiones se revocan después de guardar la contraseña nueva', async () => {
    // Act
    await service.changePassword('user-1', {
      currentPassword: 'Actual2026!abc',
      newPassword: 'Nueva2026!abcd',
    });

    // Assert
    expect(update).toHaveBeenCalledBefore(revokeAllForUser);
  });

  it('Camino 3 - con la contraseña actual errónea no se hashea, ni se revoca, ni se audita', async () => {
    // Arrange
    verify.mockResolvedValue(false);

    // Act
    const resultado = service.changePassword('user-1', {
      currentPassword: 'Errada2026!abc',
      newPassword: 'Nueva2026!abcd',
    });

    // Assert
    await expect(resultado).rejects.toThrow(UnauthorizedException);
    expect(hash).not.toHaveBeenCalled();
    expect(revokeAllForUser).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('Camino 4 - la política acepta una contraseña que cumple todo', async () => {
    // Act
    const errores = await erroresDe('Inventario2026');

    // Assert
    expect(errores).toEqual({});
  });

  it('Camino 5 - la política exige al menos 12 caracteres', async () => {
    // Act
    const errores = await erroresDe('Corta2026a');

    // Assert
    expect(errores).toHaveProperty('minLength');
  });

  it('Camino 6 - la política limita a 128 caracteres para no costear argon2 sin tope', async () => {
    // Act
    const errores = await erroresDe(`Aa1${'x'.repeat(126)}`);

    // Assert
    expect(errores).toHaveProperty('maxLength');
  });

  it.each([
    ['sin mayúscula', 'inventario2026'],
    ['sin minúscula', 'INVENTARIO2026'],
    ['sin dígito', 'InventarioBodega'],
  ])('Camino 7 - %s, reporta la regla completa de clases', async (_caso, clave) => {
    // Act
    const errores = await erroresDe(clave);

    // Assert
    expect(errores.matches).toBe(REGLA_DE_CLASES);
  });

  it('Camino 8 - una contraseña que no es texto se rechaza', async () => {
    // Act
    const errores = await erroresDe(123456789012);

    // Assert
    expect(errores).toHaveProperty('isString');
  });
});
