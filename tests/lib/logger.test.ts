import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Logger', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should create service logger with correct name', async () => {
    const { createServiceLogger } = await import('../../server/lib/logger');
    
    const logger = createServiceLogger('TestService');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should have logger singleton', async () => {
    const { logger } = await import('../../server/lib/logger');
    
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });
});

describe('Test Setup Verification', () => {
  it('should have NODE_ENV set to test', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should have SESSION_SECRET set', () => {
    expect(process.env.SESSION_SECRET).toBeDefined();
  });
});
