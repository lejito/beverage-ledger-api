import { describe, expect, inject, it } from 'vitest';
import { UserRole } from '../../../src/generated/prisma/enums';
import { Permission, roleHasPermission } from '../../../src/common/permissions/permissions.config';
import { call } from '../../support/http';
import { FOREIGN_ID } from '../../support/session';

type Rol = 'OPERATOR' | 'MANAGER' | 'ORG_ADMIN';

interface Ruta {
  metodo: string;
  ruta: string;
  permiso: Permission | null;
  /** Solo las lecturas se ejercen con un rol autorizado: una escritura cambiaría producción. */
  lectura: boolean;
}

// The routes of RF-01, 03, 06, 09, 29 and 30, with the permission each controller
// declares. The expectation comes from permissions.config.ts, so the test fails
// when the deployed API enforces something other than the declared matrix.
const RUTAS: Ruta[] = [
  { metodo: 'GET', ruta: '/auth/me', permiso: null, lectura: true },
  { metodo: 'GET', ruta: '/products', permiso: null, lectura: true },
  { metodo: 'POST', ruta: '/products', permiso: Permission.CatalogManage, lectura: false },
  {
    metodo: 'PATCH',
    ruta: `/products/${FOREIGN_ID}`,
    permiso: Permission.CatalogManage,
    lectura: false,
  },
  { metodo: 'GET', ruta: '/users', permiso: Permission.UserManage, lectura: true },
  { metodo: 'GET', ruta: `/users/${FOREIGN_ID}`, permiso: Permission.UserManage, lectura: false },
  { metodo: 'PATCH', ruta: `/users/${FOREIGN_ID}`, permiso: Permission.UserManage, lectura: false },
  { metodo: 'GET', ruta: '/invitations', permiso: Permission.UserManage, lectura: true },
  { metodo: 'POST', ruta: '/invitations', permiso: Permission.UserManage, lectura: false },
  {
    metodo: 'DELETE',
    ruta: `/invitations/${FOREIGN_ID}`,
    permiso: Permission.UserManage,
    lectura: false,
  },
  { metodo: 'GET', ruta: '/audit-logs', permiso: Permission.AuditLogRead, lectura: true },
];

const TOKENS: Record<Rol, () => string> = {
  OPERATOR: () => inject('operatorToken'),
  MANAGER: () => inject('managerToken'),
  ORG_ADMIN: () => inject('adminToken'),
};

const casos = (['OPERATOR', 'MANAGER', 'ORG_ADMIN'] as const).flatMap((rol) =>
  RUTAS.map((ruta) => ({
    rol,
    ...ruta,
    permitido: ruta.permiso === null || roleHasPermission(UserRole[rol], ruta.permiso),
  })),
);

describe('Matriz de permisos - la API desplegada aplica permissions.config.ts', () => {
  it.each(casos.filter((caso) => !caso.permitido))(
    '$rol en $metodo $ruta responde 403',
    async ({ rol, metodo, ruta }) => {
      const respuesta = await call(metodo, ruta, {
        token: TOKENS[rol](),
        body: metodo === 'GET' ? undefined : {},
      });

      expect(respuesta.status).toBe(403);
    },
  );

  it.each(casos.filter((caso) => caso.permitido && caso.lectura))(
    '$rol en $metodo $ruta responde 200',
    async ({ rol, metodo, ruta }) => {
      const respuesta = await call(metodo, ruta, { token: TOKENS[rol]() });

      expect(respuesta.status).toBe(200);
    },
  );

  it.each(RUTAS)('sin token, $metodo $ruta responde 401', async ({ metodo, ruta }) => {
    const respuesta = await call(metodo, ruta, { body: metodo === 'GET' ? undefined : {} });

    expect(respuesta.status).toBe(401);
  });
});
