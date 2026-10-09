export interface Credentials {
  email: string;
  password: string;
}

export interface DeployedApiEnv {
  /** Origin of the API, without `/api/v1` and without a trailing slash. */
  apiUrl: string;
  admin: Credentials;
  manager: Credentials;
  operator: Credentials;
  /** An account the lockout test locks on purpose; nothing else may use it. */
  lockout: Credentials;
}

function read(name: string, missing: string[]): string {
  const value = process.env[name]?.trim();
  if (!value) missing.push(name);
  return value ?? '';
}

function credentials(prefix: string, missing: string[]): Credentials {
  return { email: read(`${prefix}_EMAIL`, missing), password: read(`${prefix}_PASSWORD`, missing) };
}

/** @throws {Error} naming every variable that is missing, so a run fails once and clearly. */
export function deployedApiEnv(): DeployedApiEnv {
  const missing: string[] = [];
  const env = {
    apiUrl: read('API_URL', missing).replace(/\/+$/, ''),
    admin: credentials('CI_ADMIN', missing),
    manager: credentials('CI_MANAGER', missing),
    operator: credentials('CI_OPERATOR', missing),
    lockout: credentials('CI_LOCKOUT', missing),
  };

  if (missing.length > 0) {
    throw new Error(`The deployed-API suites need these variables: ${missing.join(', ')}`);
  }

  return env;
}
