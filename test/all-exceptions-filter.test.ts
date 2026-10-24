import { ConflictException, Logger, NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { Prisma } from '../src/generated/prisma/client';

const CODIGO = /^ERR-[0-9A-F]{8}$/;

/**
 * El filtro global, que da a todo error la misma forma y nunca deja salir
 * detalles internos. Heurística 33: cada error lleva un código que la persona
 * puede citar, y un error de servidor lo deja en el log junto a su traza.
 */
describe('AllExceptionsFilter - forma uniforme y código de referencia', () => {
  let json: ReturnType<typeof vi.fn>;
  let status: ReturnType<typeof vi.fn>;
  let registrarError: ReturnType<typeof vi.fn>;
  let host: ArgumentsHost;

  const cuerpo = () => json.mock.calls[0]![0] as Record<string, unknown>;

  beforeEach(() => {
    json = vi.fn();
    status = vi.fn().mockReturnValue({ json });
    registrarError = vi.fn();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(registrarError);
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'GET', url: '/api/v1/products/x' }),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => vi.restoreAllMocks());

  it('Camino 1 - una excepción HTTP conserva su estado y su mensaje, y lleva código', () => {
    new AllExceptionsFilter(true).catch(new NotFoundException('Product not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(cuerpo()).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Product not found',
      path: '/api/v1/products/x',
    });
    expect(cuerpo().code).toMatch(CODIGO);
    expect(registrarError).not.toHaveBeenCalled();
  });

  it('Camino 2 - dos errores seguidos no comparten código', () => {
    const filtro = new AllExceptionsFilter(true);
    filtro.catch(new ConflictException(), host);
    filtro.catch(new ConflictException(), host);

    const [primero, segundo] = json.mock.calls.map(
      ([enviado]) => (enviado as { code: string }).code,
    );
    expect(primero).not.toBe(segundo);
  });

  it('Camino 3 - un error conocido de Prisma se traduce sin nombres de tablas', () => {
    const duplicado = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`organization_id`,`name`)',
      { code: 'P2002', clientVersion: '7' },
    );

    new AllExceptionsFilter(true).catch(duplicado, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(cuerpo().message).toBe('A record with those values already exists');
    expect(JSON.stringify(cuerpo())).not.toMatch(/organization_id/);
  });

  it('Camino 4 - un error inesperado responde 500 genérico y deja su código en el log', () => {
    new AllExceptionsFilter(true).catch(new Error('connection reset by pg'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(cuerpo().message).toBe('Internal server error');
    const [linea] = registrarError.mock.calls[0]! as [string];
    expect(linea.startsWith(`${cuerpo().code as string} GET /api/v1/products/x`)).toBe(true);
  });
});
