CREATE TABLE IF NOT EXISTS "authz_grants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"principal_kind" text NOT NULL,
	"principal_id" text NOT NULL,
	"workspace_id" text DEFAULT '' NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"scope" text NOT NULL,
	"source" text DEFAULT 'ADMIN',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pc_devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"os_version" text,
	"capabilities" jsonb,
	"status" text DEFAULT 'OFFLINE' NOT NULL,
	"ip_address" varchar,
	"last_seen" timestamp,
	"registered_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pc_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar NOT NULL,
	"user_id" varchar,
	"status" text DEFAULT 'CONNECTING' NOT NULL,
	"last_activity" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar,
	"execution_id" varchar,
	"type" text NOT NULL,
	"severity" text DEFAULT 'MEDIUM' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"channels" jsonb,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"read_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_executions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"task_name" text,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"triggered_by" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"result" jsonb,
	"action_results" jsonb,
	"execution_source" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" text DEFAULT 'MANUAL' NOT NULL,
	"trigger_config" jsonb,
	"actions" jsonb NOT NULL,
	"options" jsonb,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"enabled" boolean DEFAULT true,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "coze_api_key" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "coze_bot_id" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "coze_workflow_id" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "coze_enabled" text DEFAULT 'false';--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "coze_workflow_doc_format" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "coze_workflow_doc_polish" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "coze_workflow_doc_translate" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "coze_workflow_doc_summarize" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "coze_workflow_ppt" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "coze_workflow_report" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "coze_workflow_code_review" text;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pc_sessions_device_id_pc_devices_id_fk') THEN
		ALTER TABLE "pc_sessions" ADD CONSTRAINT "pc_sessions_device_id_pc_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."pc_devices"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_alerts_task_id_tasks_id_fk') THEN
		ALTER TABLE "task_alerts" ADD CONSTRAINT "task_alerts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_alerts_execution_id_task_executions_id_fk') THEN
		ALTER TABLE "task_alerts" ADD CONSTRAINT "task_alerts_execution_id_task_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."task_executions"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_executions_task_id_tasks_id_fk') THEN
		ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "authz_grants_uniq" ON "authz_grants" USING btree ("principal_kind","principal_id","workspace_id","resource","action","scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "authz_grants_principal_idx" ON "authz_grants" USING btree ("principal_kind","principal_id");
