import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditAction, AuditEntity } from '../../src/modules/audit/audit.actions';
import type { AuditService } from '../../src/modules/audit/audit.service';
import { ProductsAdminService } from '../../src/modules/catalog/products-admin.service';
import { ProductsService } from '../../src/modules/catalog/products.service';
import type { ProductsRepository } from '../../src/modules/catalog/repositories/products.repository';

/**
 * Regresión de RF-09: lo que la edición de un producto protege fuera de sus
 * caminos. Un id ajeno da 404, un nombre repetido no llega a escribirse, la
 * desactivación se audita como tal y un producto desactivado sale de los
 * movimientos nuevos sin borrarse.
 */
describe('RF-09 - Regresión de la gestión de productos', () => {
  const PRODUCTO = { id: 'product-1', name: 'Havana Club 7', isActive: true };

  let admin: ProductsAdminService;
  let catalogo: ProductsService;
  let findById: ReturnType<typeof vi.fn>;
  let existsWithName: ReturnType<typeof vi.fn>;
  let categoryExists: ReturnType<typeof vi.fn>;
  let brandExists: ReturnType<typeof vi.fn>;
  let findMovementTargets: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let record: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findById = vi.fn().mockResolvedValue(PRODUCTO);
    existsWithName = vi.fn().mockResolvedValue(false);
    categoryExists = vi.fn().mockResolvedValue(true);
    brandExists = vi.fn().mockResolvedValue(true);
    findMovementTargets = vi.fn();
    update = vi.fn();
    record = vi.fn();

    const repository = {
      findById,
      existsWithName,
      categoryExists,
      brandExists,
      findMovementTargets,
      update,
    } as unknown as ProductsRepository;

    catalogo = new ProductsService(repository);
    admin = new ProductsAdminService(repository, catalogo, { record } as unknown as AuditService);
  });

  it('Camino 1 - editar un producto de otra organización responde 404 y no escribe', async () => {
    // Arrange
    findById.mockResolvedValue(null);

    // Act
    const resultado = admin.update('product-ajeno', { name: 'Otro nombre' });

    // Assert
    await expect(resultado).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('Camino 2 - renombrar a un nombre ya usado responde 409 y no escribe', async () => {
    // Arrange
    existsWithName.mockResolvedValue(true);

    // Act
    const resultado = admin.update('product-1', { name: 'Bacardi Blanco' });

    // Assert
    await expect(resultado).rejects.toThrow(ConflictException);
    expect(existsWithName).toHaveBeenCalledWith('Bacardi Blanco', 'product-1');
    expect(update).not.toHaveBeenCalled();
  });

  it('Camino 3 - cambiar a una categoría inexistente responde 400 y no escribe', async () => {
    // Arrange
    categoryExists.mockResolvedValue(false);

    // Act
    const resultado = admin.update('product-1', { categoryId: 'category-fantasma' });

    // Assert
    await expect(resultado).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('Camino 4 - desactivar se audita como desactivación, no como edición', async () => {
    // Arrange
    findById
      .mockResolvedValueOnce(PRODUCTO)
      .mockResolvedValueOnce({ ...PRODUCTO, isActive: false });

    // Act
    await admin.update('product-1', { isActive: false });

    // Assert
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ProductDeactivated,
        entity: AuditEntity.Product,
        entityId: 'product-1',
      }),
    );
  });

  it('Camino 5 - renombrar deja en la auditoría el nombre anterior y el nuevo', async () => {
    // Act
    await admin.update('product-1', { name: 'Havana Club 7 Años' });

    // Assert
    expect(record).toHaveBeenCalledWith({
      action: AuditAction.ProductUpdated,
      entity: AuditEntity.Product,
      entityId: 'product-1',
      metadata: {
        nameFrom: 'Havana Club 7',
        nameTo: 'Havana Club 7 Años',
        isActiveTo: undefined,
      },
    });
  });

  it('Camino 6 - un producto desactivado no puede usarse en un movimiento nuevo', async () => {
    // Arrange
    findMovementTargets.mockResolvedValue([{ ...PRODUCTO, isActive: false }]);

    // Act
    const resultado = catalogo.resolveMovementTargets(['product-1']);

    // Assert
    await expect(resultado).rejects.toThrow(BadRequestException);
    await expect(resultado).rejects.toThrow(/Havana Club 7/);
  });

  it('Camino 7 - un producto que no es de la organización no puede usarse en un movimiento', async () => {
    // Arrange
    findMovementTargets.mockResolvedValue([]);

    // Act
    const resultado = catalogo.resolveMovementTargets(['product-ajeno']);

    // Assert
    await expect(resultado).rejects.toThrow(/product-ajeno/);
  });

  it('Camino 8 - los productos no se borran: el service no expone eliminación', () => {
    // Act
    const metodos = Object.getOwnPropertyNames(ProductsAdminService.prototype);

    // Assert
    expect(metodos).not.toContain('delete');
    expect(metodos).not.toContain('remove');
  });
});
