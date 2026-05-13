import { sql } from 'drizzle-orm';
import { getDatabase, isDatabaseAvailable } from '../db';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('AssistantRuntimeSchema');

export async function ensureAssistantRuntimeSchema(): Promise<void> {
  if (!isDatabaseAvailable()) {
    logger.debug('Database unavailable; assistant runtime schema ensure skipped');
    return;
  }

  const db = getDatabase();
  if (!db) {
    logger.debug('Database handle unavailable; assistant runtime schema ensure skipped');
    return;
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "swarm_tasks" (
      "id" text PRIMARY KEY NOT NULL,
      "task_name" text NOT NULL,
      "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "target_nodes" text NOT NULL DEFAULT 'ALL',
      "delivered_count" integer NOT NULL DEFAULT 0,
      "broadcasted_at" timestamp with time zone NOT NULL DEFAULT now(),
      "reports" jsonb NOT NULL DEFAULT '[]'::jsonb
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pending_actions" (
      "id" text PRIMARY KEY NOT NULL,
      "entry_type" text NOT NULL,
      "action" text,
      "action_params" jsonb,
      "items" jsonb,
      "user_id" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "created_at" timestamp with time zone NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_pending_actions_user_id"
    ON "pending_actions" ("user_id")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_pending_actions_expires_at"
    ON "pending_actions" ("expires_at")
  `);

  logger.info('Assistant runtime tables ensured');
}
