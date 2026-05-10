-- Mobile conversation runtime tables.
-- These tables back the conversation-first mobile home and restart-safe assistant confirmations.

CREATE TABLE IF NOT EXISTS "device_bindings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" varchar NOT NULL,
  "identity_id" varchar NOT NULL,
  "device_id" text NOT NULL,
  "device_type" text NOT NULL,
  "provider" text NOT NULL,
  "display_name" text,
  "status" text NOT NULL DEFAULT 'active',
  "capabilities" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "allowed_modes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "risk_policy" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "last_seen_at" timestamp,
  "bound_at" timestamp NOT NULL DEFAULT now(),
  "revoked_at" timestamp,
  CONSTRAINT "device_bindings_device_id_unique" UNIQUE ("device_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_device_bindings_owner_id" ON "device_bindings" ("owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_device_bindings_status" ON "device_bindings" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "swarm_tasks" (
  "id" text PRIMARY KEY NOT NULL,
  "task_name" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "target_nodes" text NOT NULL DEFAULT 'ALL',
  "delivered_count" integer NOT NULL DEFAULT 0,
  "broadcasted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "reports" jsonb NOT NULL DEFAULT '[]'::jsonb
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pending_actions" (
  "id" text PRIMARY KEY NOT NULL,
  "entry_type" text NOT NULL,
  "action" text,
  "action_params" jsonb,
  "items" jsonb,
  "user_id" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pending_actions_user_id" ON "pending_actions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pending_actions_expires_at" ON "pending_actions" ("expires_at");
