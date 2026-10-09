import { describe, expect, inject, it } from 'vitest';
import { call } from '../../support/http';
import { contractViolations } from '../../support/openapi';

interface Invitacion {
  id: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

/**
 * Regresión de API de RF-03. El alta por invitación de la corrida la hace el
 * global setup, porque crea un usuario que no se puede borrar y solo debe
 * existir uno por corrida; aquí se comprueba lo que respondió y todo lo demás.
 */
describe('RF-03 - API de invitaciones', () => {
  const admin = () => inject('adminToken');
  const usuarioDeLaCorrida = () => inject('runUser')!;

  it('Caso 1 - aceptar una invitación responde 201 con una sesión del rol invitado', async () => {
    const { acceptStatus, acceptBody } = usuarioDeLaCorrida();

    expect(acceptStatus).toBe(201);
    expect(await contractViolations(acceptBody, 'SessionDto')).toEqual([]);
    expect(acceptBody.user.role).toBe('OPERATOR');
    expect(acceptBody.user.status).toBe('ACTIVE');
  });

  it('Caso 2 - el listado cumple el contrato y marca como aceptada la invitación usada', async () => {
    const respuesta = await call<{ data: Invitacion[] }>('GET', '/invitations?pageSize=100', {
      token: admin(),
    });
    const usada = respuesta.body.data.find(
      (invitacion) => invitacion.id === usuarioDeLaCorrida().invitationId,
    );

    expect(respuesta.status).toBe(200);
    expect(await contractViolations(respuesta.body, 'InvitationPageDto')).toEqual([]);
    expect(usada?.acceptedAt).toBeTruthy();
  });

  it('Caso 3 - un token ya gastado no se puede consultar ni volver a aceptar', async () => {
    const token = usuarioDeLaCorrida().invitationToken;

    const consulta = await call('POST', '/invitations/lookup', { body: { token } });
    const aceptar = await call('POST', '/invitations/accept', {
      body: { token, name: 'Segundo intento', password: 'Segundo-Intento-2026' },
    });

    expect(consulta.status).toBe(404);
    expect(aceptar.status).toBe(404);
  });

  it('Caso 4 - emitir, previsualizar y revocar una invitación sin aceptarla', async () => {
    const email = `ci-revocada+${Date.now()}@beverageledger.test`;
    const emitida = await call<{ invitation: Invitacion; acceptUrl: string }>(
      'POST',
      '/invitations',
      {
        token: admin(),
        body: { email, role: 'MANAGER' },
      },
    );
    const token = new URL(emitida.body.acceptUrl).pathname.split('/').pop()!;

    const vistaPrevia = await call<{ email: string; role: string }>('POST', '/invitations/lookup', {
      body: { token },
    });
    const revocar = await call('DELETE', `/invitations/${emitida.body.invitation.id}`, {
      token: admin(),
    });
    const consultaRevocada = await call('POST', '/invitations/lookup', { body: { token } });
    const revocarOtraVez = await call('DELETE', `/invitations/${emitida.body.invitation.id}`, {
      token: admin(),
    });

    expect(emitida.status).toBe(201);
    expect(await contractViolations(emitida.body, 'IssuedInvitationDto')).toEqual([]);
    expect(emitida.body.acceptUrl).toContain('/invite/');
    expect(vistaPrevia.status).toBe(200);
    expect(await contractViolations(vistaPrevia.body, 'InvitationPreviewDto')).toEqual([]);
    expect(vistaPrevia.body).toMatchObject({ email, role: 'MANAGER' });
    expect(revocar.status).toBe(204);
    expect(consultaRevocada.status).toBe(404);
    expect(revocarOtraVez.status).toBe(409);
  });

  it('Caso 5 - invitar a alguien que ya es miembro responde 409', async () => {
    const respuesta = await call('POST', '/invitations', {
      token: admin(),
      body: { email: usuarioDeLaCorrida().email, role: 'OPERATOR' },
    });

    expect(respuesta.status).toBe(409);
  });
});
