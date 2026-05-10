-- Authorization grants: session/user principals (ADR 0001)
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

CREATE UNIQUE INDEX IF NOT EXISTS "authz_grants_uniq" ON "authz_grants" (
	"principal_kind",
	"principal_id",
	"workspace_id",
	"resource",
	"action",
	"scope"
);

CREATE INDEX IF NOT EXISTS "authz_grants_principal_idx" ON "authz_grants" ("principal_kind", "principal_id");
