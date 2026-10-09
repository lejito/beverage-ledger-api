import { randomBytes } from 'node:crypto';
import type { Credentials } from './env';
import { call, REFRESH_COOKIE, type ApiResponse } from './http';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

export interface SessionBody {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export function sessionFrom(response: ApiResponse<SessionBody>): Session {
  return {
    accessToken: response.body.accessToken,
    refreshToken: response.cookies[REFRESH_COOKIE] ?? '',
    user: response.body.user,
  };
}

/** @throws {Error} when the credentials do not open a session, naming the account. */
export async function login(credentials: Credentials): Promise<Session> {
  const response = await call<SessionBody>('POST', '/auth/login', { body: credentials });
  if (response.status !== 200) {
    throw new Error(`Could not sign in as ${credentials.email}: HTTP ${response.status}`);
  }
  return sessionFrom(response);
}

/** Meets the password policy: 12+ characters with a lowercase, an uppercase and a digit. */
export function strongPassword(): string {
  return `Ci-${randomBytes(9).toString('base64url')}a7Z`;
}

/** A UUID no organization can own, for the 404 paths. */
export const FOREIGN_ID = '00000000-0000-4000-8000-000000000000';
