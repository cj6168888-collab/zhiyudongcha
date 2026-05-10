import { createServiceLogger } from './logger';

const logger = createServiceLogger('ConfigValidator');

const MIN_SECRET_LENGTH = 16;
const MIN_PRODUCTION_SECRET_LENGTH = 64;
const LOCAL_ONLY_VALUES = new Set([
  'local-session-secret-that-is-long-enough-for-dev',
  'local-avatar-master-secret-that-is-at-least-sixty-four-characters-long',
  'local-secure-config-secret-that-is-at-least-sixty-four-characters-long',
]);

function warnIfWeakSecret(name: string, value: string | undefined): void {
  if (!value || value.length < MIN_SECRET_LENGTH) {
    logger.warn(
      { name, minLength: MIN_SECRET_LENGTH },
      `${name} is missing or shorter than the recommended minimum`
    );
  }
}

export function validateEnvConfig(): void {
  const requiredInProduction = ['SESSION_SECRET', 'AVATAR_MASTER_SECRET', 'MASTER_SECRET', 'DATABASE_URL'];
  const missing = requiredInProduction.filter((name) => !process.env[name]);

  if (process.env.NODE_ENV === 'production' && missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV === 'production') {
    for (const name of ['SESSION_SECRET', 'AVATAR_MASTER_SECRET', 'MASTER_SECRET']) {
      const value = process.env[name];
      if (value && value.length < MIN_PRODUCTION_SECRET_LENGTH) {
        throw new Error(`${name} must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`);
      }

      if (value && LOCAL_ONLY_VALUES.has(value)) {
        throw new Error(`${name} uses a local-only default and must be replaced in production`);
      }

      if (value?.startsWith('replace-with')) {
        throw new Error(`${name} still uses a placeholder value and must be replaced in production`);
      }
    }
  }

  warnIfWeakSecret('SESSION_SECRET', process.env.SESSION_SECRET);
  warnIfWeakSecret('AVATAR_MASTER_SECRET', process.env.AVATAR_MASTER_SECRET);
  warnIfWeakSecret('MASTER_SECRET', process.env.MASTER_SECRET);

  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    logger.warn('No DATABASE_URL or DB_HOST configured; database access will use local defaults');
  }
}

export default validateEnvConfig;
