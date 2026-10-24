import { describe, expect, it } from 'vitest';
import { call } from '../../support/http';

/** Regresión de seguridad transversal: cabeceras, CORS y errores sin detalles internos. */
describe('Cabeceras, CORS y errores de la API desplegada', () => {
  it('Caso 1 - Helmet entrega sus cabeceras y no se anuncia Express', async () => {
    const { headers } = await call('GET', '/health');

    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-frame-options')).toBeTruthy();
    expect(headers.get('strict-transport-security')).toBeTruthy();
    expect(headers.get('content-security-policy')).toBeTruthy();
    expect(headers.get('x-powered-by')).toBeNull();
  });

  it('Caso 2 - un origen que no está en CORS_ORIGINS no recibe permiso de CORS', async () => {
    const { headers } = await call('OPTIONS', '/auth/login', {
      headers: { Origin: 'https://atacante.example', 'Access-Control-Request-Method': 'POST' },
    });

    expect(headers.get('access-control-allow-origin')).not.toBe('https://atacante.example');
    expect(headers.get('access-control-allow-origin')).not.toBe('*');
  });

  it('Caso 3 - una ruta inexistente responde 404 sin trazas ni nombres internos', async () => {
    const respuesta = await call('GET', '/no-existe');

    expect(respuesta.status).toBe(404);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/stack|prisma|node_modules|at \w+ \(/i);
  });

  // Heurística 33: el código que la persona cita al reportar el error.
  it('Caso 4 - un error lleva un código de referencia', async () => {
    const respuesta = await call<Record<string, unknown>>('GET', '/no-existe');

    expect(respuesta.body.code).toMatch(/^ERR-[0-9A-F]{8}$/);
  });
});
