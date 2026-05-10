-- P0 Conversation 底座迁移
-- 对应: docs/technical/20_PERCEPTION_DEVICE_IMPLEMENTATION_SPEC.md

CREATE TABLE IF NOT EXISTS "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"source" text NOT NULL,
	"source_device_id" text,
	"external_source_id" text,
	"mode" text,
	"status" text NOT NULL DEFAULT 'in_progress',
	"language" text,
	"title" text,
	"summary" text,
	"key_points" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"raw_payload_ref" text,
	"hash" text,
	"started_at" timestamp NOT NULL DEFAULT now(),
	"ended_at" timestamp,
	"imported_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_external_source_uniq"
  ON "conversations" ("source", "external_source_id")
  WHERE "external_source_id" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "conv_segments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sequence" integer NOT NULL,
	"segment_type" text NOT NULL,
	"text" text,
	"speaker" text,
	"speaker_type" text,
	"person_id" varchar,
	"start_ms" integer,
	"end_ms" integer,
	"confidence" numeric,
	"media_ref" text,
	"raw_payload_ref" text,
	"source" text NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conv_seg_conversation_idx" ON "conv_segments" ("conversation_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "conversation_candidates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"candidate_type" text NOT NULL,
	"status" text NOT NULL DEFAULT 'pending',
	"content" jsonb NOT NULL,
	"confidence" numeric,
	"risk_level" text,
	"linked_entity_id" varchar,
	"linked_entity_type" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conv_candidate_conversation_idx" ON "conversation_candidates" ("conversation_id");
CREATE INDEX IF NOT EXISTS "conv_candidate_status_idx" ON "conversation_candidates" ("status");
--> statement-breakpoint

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

CREATE TABLE IF NOT EXISTS "provider_sync_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"account_ref" text,
	"cursor" text,
	"last_synced_at" timestamp,
	"status" text NOT NULL DEFAULT 'idle',
	"error_message" text,
	"config" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
