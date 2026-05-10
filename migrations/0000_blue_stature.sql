CREATE TABLE "alignment_signals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_type" text NOT NULL,
	"proposal_id" varchar,
	"opportunity_id" varchar,
	"user_action" text,
	"preference_category" text,
	"preference_value" jsonb,
	"context_snapshot" jsonb,
	"weight_adjustment" real DEFAULT 0,
	"processed_for_training" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"details" jsonb,
	"ip_address" text,
	"device_info" text,
	"result" text DEFAULT 'SUCCESS',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "avatar_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"avatar_name" text NOT NULL,
	"device_id" text NOT NULL,
	"device_name" text,
	"role" text DEFAULT 'EMPLOYEE',
	"supervisor_id" varchar,
	"permission_level" integer DEFAULT 5,
	"can_access_team_data" integer DEFAULT 1,
	"can_access_executive_data" integer DEFAULT 0,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "avatar_chat_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"intent" text,
	"emotion" text,
	"topic_tags" text[],
	"feedback" integer,
	"feedback_note" text,
	"is_memorized" integer DEFAULT 0,
	"memory_weight" real DEFAULT 0.5,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "avatar_nodes" (
	"node_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"device_fingerprint" text NOT NULL,
	"node_type" text NOT NULL,
	"node_name" text,
	"node_specific_config" jsonb DEFAULT '{}'::jsonb,
	"hp_balance" integer DEFAULT 1000,
	"max_hp" integer DEFAULT 1000,
	"is_unlimited" boolean DEFAULT false,
	"last_recharge_at" timestamp,
	"is_online" boolean DEFAULT false,
	"last_active_at" timestamp,
	"installed_skills" text[],
	"device_capabilities" jsonb DEFAULT '{}'::jsonb,
	"local_ollama_endpoint" text,
	"local_ollama_model" text,
	"local_ollama_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "avatar_nodes_device_fingerprint_unique" UNIQUE("device_fingerprint")
);
--> statement-breakpoint
CREATE TABLE "avatar_user_preferences" (
	"id" varchar PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"preferred_name" text,
	"master_title" text DEFAULT '主人',
	"favorite_topics" text[],
	"avoid_topics" text[],
	"active_hours" jsonb,
	"preferred_style" text DEFAULT 'warm',
	"preferred_length" text DEFAULT 'medium',
	"custom_rules" text[],
	"learned_patterns" jsonb,
	"positive_examples" text[],
	"negative_examples" text[],
	"total_chats" integer DEFAULT 0,
	"positive_count" integer DEFAULT 0,
	"negative_count" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "battle_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_type" text NOT NULL,
	"source_device_id" varchar,
	"source_member_id" varchar,
	"title" text NOT NULL,
	"summary" text,
	"details" jsonb,
	"opportunities_found" integer DEFAULT 0,
	"traps_detected" integer DEFAULT 0,
	"contracts_analyzed" integer DEFAULT 0,
	"decisions_assisted" integer DEFAULT 0,
	"risk_level" text DEFAULT 'LOW',
	"priority" integer DEFAULT 5,
	"actions_taken" jsonb,
	"outcomes" jsonb,
	"lessons_learned" text,
	"tags" text[],
	"related_person_ids" text[],
	"is_escalated" boolean DEFAULT false,
	"escalated_to" text,
	"escalated_at" timestamp,
	"report_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "behavior_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_type" text NOT NULL,
	"day_of_week" integer,
	"hour_of_day" integer,
	"is_weekday" boolean,
	"energy_level" real,
	"focus_score" real,
	"productivity_score" real,
	"location_category" text,
	"time_at_location" integer,
	"primary_activity" text,
	"screen_time" integer,
	"is_optimal_for_work" boolean,
	"is_optimal_for_creative" boolean,
	"is_optimal_for_social" boolean,
	"is_optimal_for_rest" boolean,
	"recorded_date" timestamp NOT NULL,
	"sample_count" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "biometric_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"face_embedding" text,
	"face_enrolled_at" timestamp,
	"face_quality_score" real,
	"face_feature_hash" text,
	"face_sample_count" integer DEFAULT 0,
	"voice_embedding" text,
	"voice_enrolled_at" timestamp,
	"voice_quality_score" real,
	"voice_feature_hash" text,
	"voice_sample_count" integer DEFAULT 0,
	"fingerprint_credential_id" text,
	"fingerprint_public_key" text,
	"fingerprint_enrolled_at" timestamp,
	"total_verification_count" integer DEFAULT 0,
	"successful_verifications" integer DEFAULT 0,
	"failed_verifications" integer DEFAULT 0,
	"last_verified_at" timestamp,
	"last_verification_type" text,
	"failed_attempt_count" integer DEFAULT 0,
	"locked_until" timestamp,
	"security_level" text DEFAULT 'LOW',
	"enrolled_devices" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "biometric_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "biometric_verification_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"verification_type" text NOT NULL,
	"success" boolean NOT NULL,
	"confidence_score" real,
	"similarity_score" real,
	"failure_reason" text,
	"device_id" text,
	"ip_address" text,
	"user_agent" text,
	"liveness_check_passed" boolean,
	"spoofing_detected" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_type" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"all_day" boolean DEFAULT false,
	"priority" text DEFAULT 'NORMAL',
	"is_forced" boolean DEFAULT false,
	"is_completed" boolean DEFAULT false,
	"fatigue_impact" integer DEFAULT 0,
	"energy_required" integer DEFAULT 50,
	"recurrence" text,
	"recurrence_end_date" timestamp,
	"location" text,
	"attendees" text[],
	"tags" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "call_analysis_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" varchar,
	"person_name" text,
	"call_direction" text,
	"call_duration" integer,
	"audio_file_path" text,
	"transcript_text" text,
	"transcript_confidence" real,
	"emotion_analysis" jsonb,
	"key_points" jsonb,
	"action_items" jsonb,
	"sentiment" text,
	"sentiment_score" real,
	"status" text DEFAULT 'PENDING',
	"call_started_at" timestamp,
	"call_ended_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "call_emotion_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text,
	"person_id" varchar,
	"call_direction" text NOT NULL,
	"call_duration" integer,
	"call_time" timestamp NOT NULL,
	"pre_call_heart_rate" integer,
	"during_call_heart_rate" integer,
	"post_call_heart_rate" integer,
	"heart_rate_change" integer,
	"emotion_score" integer,
	"emotion_type" text,
	"voice_tone_analysis" jsonb,
	"conversation_mood" text,
	"impact_on_day" text,
	"suggested_action" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "capability_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_description" text NOT NULL,
	"task_type" text,
	"has_permission" integer DEFAULT 0,
	"has_compute_resource" integer DEFAULT 0,
	"has_knowledge_base" integer DEFAULT 0,
	"has_time_window" integer DEFAULT 0,
	"has_external_dependency" integer DEFAULT 0,
	"missing_capabilities" jsonb,
	"can_commit" integer DEFAULT 0,
	"confidence_level" real DEFAULT 0,
	"suggested_action" text,
	"honest_response" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "care_notification_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_id" varchar NOT NULL,
	"notification_type" text NOT NULL,
	"title" text,
	"message" text NOT NULL,
	"priority" text DEFAULT 'MEDIUM',
	"status" text DEFAULT 'PENDING',
	"scheduled_at" timestamp,
	"expires_at" timestamp,
	"sent_at" timestamp,
	"retry_count" integer DEFAULT 0,
	"last_error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "case_studies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_number" text,
	"case_name" text NOT NULL,
	"case_type" text NOT NULL,
	"court_name" text,
	"court_level" text,
	"judgment_date" timestamp,
	"plaintiff" text,
	"defendant" text,
	"case_background" text,
	"case_content" text,
	"judgment_result" text,
	"winning_strategy" text,
	"key_tactics" jsonb,
	"legal_basis" text[],
	"evidence_strategy" text,
	"court_argument_highlights" text,
	"lessons_learned" text,
	"applicable_scenarios" text[],
	"success_indicators" text[],
	"is_analyzed" boolean DEFAULT false,
	"analyzed_at" timestamp,
	"analysis_model" text,
	"sync_version" integer DEFAULT 1,
	"synced_to_devices" text[],
	"last_synced_at" timestamp,
	"source_type" text,
	"source_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_extracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"device_id" text NOT NULL,
	"chat_type" text NOT NULL,
	"chat_name" text,
	"contact_id" varchar,
	"participants" text[],
	"core_requests" jsonb,
	"commitments" jsonb,
	"timeline_events" jsonb,
	"emotion_points" jsonb,
	"opportunities" jsonb,
	"warnings" jsonb,
	"total_messages" integer DEFAULT 0,
	"extracted_messages" integer DEFAULT 0,
	"date_range" jsonb,
	"embedding_vector" text,
	"privacy_zone" text DEFAULT 'ZONE_RED',
	"local_only" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "code_patches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_module" text NOT NULL,
	"patch_type" text NOT NULL,
	"original_code" text,
	"patched_code" text,
	"patch_description" text,
	"performance_gain" real,
	"tests_passed" integer DEFAULT 0,
	"tests_total" integer DEFAULT 0,
	"sandbox_result" text,
	"applied_at" timestamp,
	"rollback_at" timestamp,
	"is_deployed" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compute_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'QUEUED',
	"priority" integer DEFAULT 5,
	"input_payload" jsonb,
	"output_result" jsonb,
	"progress" integer DEFAULT 0,
	"processing_time_ms" integer,
	"source_device" text DEFAULT 'Z5_MOBILE',
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "contact_biometrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" varchar NOT NULL,
	"biometric_type" text NOT NULL,
	"feature_hash" text NOT NULL,
	"feature_description" text NOT NULL,
	"quality_score" real DEFAULT 0.8,
	"sample_count" integer DEFAULT 1,
	"captured_at" timestamp,
	"device_info" text,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"last_matched_at" timestamp,
	"match_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_name" text,
	"contract_type" text,
	"file_source" text,
	"original_text" text,
	"clauses_json" jsonb,
	"risk_points" jsonb,
	"overall_risk_level" text,
	"legal_references" text[],
	"analysis_mode" text DEFAULT 'OFFLINE',
	"processing_time_ms" integer,
	"model_used" text,
	"user_feedback" text,
	"feedback_note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_drafts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"party_a" jsonb,
	"party_b" jsonb,
	"project_name" text,
	"contract_amount" real,
	"currency" text DEFAULT 'CNY',
	"start_date" timestamp,
	"end_date" timestamp,
	"draft_content" text,
	"filled_fields" jsonb,
	"risk_analysis" jsonb,
	"negotiation_points" text[],
	"status" text DEFAULT 'DRAFT',
	"version" integer DEFAULT 1,
	"parent_draft_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"page_number" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text,
	"file_type" text,
	"file_size" integer,
	"capture_method" text,
	"ocr_text" text,
	"ocr_confidence" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"template_content" text NOT NULL,
	"required_fields" text[],
	"optional_fields" text[],
	"risk_clauses" jsonb,
	"negotiation_tips" text[],
	"industry" text,
	"jurisdiction" text DEFAULT '中国大陆',
	"usage_count" integer DEFAULT 0,
	"rating" real DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'DRAFT',
	"related_person_id" varchar,
	"related_project_id" varchar,
	"total_pages" integer DEFAULT 0,
	"contract_type" text,
	"legal_review_status" text DEFAULT 'PENDING',
	"finance_review_status" text DEFAULT 'PENDING',
	"created_by" text DEFAULT 'MASTER',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_emotional_context" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar,
	"dominant_emotion" text,
	"emotion_intensity" real DEFAULT 0.5,
	"topics_discussed" text[],
	"entities_extracted" jsonb,
	"proactive_care_triggered" integer DEFAULT 0,
	"proactive_care_type" text,
	"session_start" timestamp,
	"session_end" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dream_log_id" varchar,
	"source_date" timestamp NOT NULL,
	"conversation_count" integer DEFAULT 0,
	"mentioned_persons" text[],
	"mentioned_topics" text[],
	"mentioned_organizations" text[],
	"overall_sentiment" real DEFAULT 0,
	"sentiment_breakdown" jsonb,
	"key_entities" jsonb,
	"interest_signals" jsonb,
	"opportunity_hints" jsonb,
	"concern_indicators" jsonb,
	"frequent_queries" text[],
	"preferred_interaction_time" text,
	"response_patterns" jsonb,
	"is_processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_type" text NOT NULL,
	"pattern_text" text NOT NULL,
	"embedding" text,
	"keywords" text[],
	"response_template" text,
	"linked_skill_id" varchar,
	"occurrence_count" integer DEFAULT 1,
	"last_occurrence" timestamp,
	"auto_respond" integer DEFAULT 0,
	"confidence" real DEFAULT 0.5,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_segments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"speaker_role" text DEFAULT 'UNKNOWN',
	"speaker_name" text,
	"content" text NOT NULL,
	"timestamp" real DEFAULT 0,
	"duration" real DEFAULT 0,
	"confidence" real DEFAULT 0.8,
	"intent" text,
	"sentiment" text,
	"importance" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_energy_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" timestamp NOT NULL,
	"total_energy_score" real,
	"physical_energy_spent" real,
	"mental_energy_spent" real,
	"emotional_energy_spent" real,
	"sleep_recovery_score" real,
	"restfulness_score" real,
	"overall_stress_level" real,
	"stress_peak_time" text,
	"stress_triggers" jsonb,
	"social_health_score" real,
	"positive_interactions" integer,
	"negative_interactions" integer,
	"key_relationship_alerts" text[],
	"productivity_peak_hours" text[],
	"focus_time_minutes" integer,
	"interruption_count" integer,
	"key_insights" jsonb,
	"anomalies" jsonb,
	"tomorrow_recommendations" jsonb,
	"suggested_wake_time" text,
	"suggested_sleep_time" text,
	"suggested_break_times" text[],
	"priority_tasks" text[],
	"avoidance_recommendations" text[],
	"weekly_trend" text,
	"monthly_comparison" real,
	"analysis_model" text,
	"confidence_score" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" timestamp NOT NULL,
	"summary" text,
	"key_events" jsonb,
	"opportunities" jsonb,
	"predictions" jsonb,
	"risks" jsonb,
	"suggested_actions" jsonb,
	"hp_consumed" integer DEFAULT 0,
	"xp_gained" integer DEFAULT 0,
	"is_read" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_apps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"package_name" text NOT NULL,
	"app_name" text NOT NULL,
	"version" text,
	"memory_usage_mb" integer DEFAULT 0,
	"storage_usage_mb" integer DEFAULT 0,
	"battery_drain_percent" real DEFAULT 0,
	"cpu_usage_percent" real DEFAULT 0,
	"network_usage_mb" real DEFAULT 0,
	"permissions_granted" text[],
	"sensitive_permissions" text[],
	"permission_risk_score" integer DEFAULT 0,
	"background_activity" boolean DEFAULT false,
	"auto_start" boolean DEFAULT false,
	"data_leak_risk" boolean DEFAULT false,
	"threat_level" text DEFAULT 'SAFE',
	"threat_reasons" text[],
	"is_system_app" boolean DEFAULT false,
	"is_trusted" boolean DEFAULT true,
	"last_scanned_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_heartbeats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"device_type" text NOT NULL,
	"device_name" text NOT NULL,
	"last_heartbeat" timestamp NOT NULL,
	"heartbeat_interval_ms" integer DEFAULT 1000,
	"is_online" integer DEFAULT 1,
	"connection_quality" text DEFAULT 'GOOD',
	"has_camera" integer DEFAULT 0,
	"has_microphone" integer DEFAULT 0,
	"has_audio_output" integer DEFAULT 1,
	"screen_width" integer,
	"screen_height" integer,
	"ip_address" text,
	"user_agent" text,
	"priority" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "device_heartbeats_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"device_name" text NOT NULL,
	"device_type" text NOT NULL,
	"status" text DEFAULT 'OFFLINE',
	"capabilities" text[],
	"auth_token_hash" text,
	"last_seen" timestamp,
	"last_command_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"document_id" varchar NOT NULL,
	"role" text NOT NULL,
	"message_type" text NOT NULL,
	"content" text NOT NULL,
	"structured_diff" jsonb,
	"affected_fields" text[],
	"relevance_score" real DEFAULT 1,
	"is_applied" boolean DEFAULT false,
	"parent_message_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"page_number" integer DEFAULT 1,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_mime_type" text,
	"file_size" integer,
	"file_path" text,
	"status" text DEFAULT 'PENDING',
	"raw_text" text,
	"ocr_confidence" real,
	"extracted_entities" jsonb,
	"error_message" text,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_supplements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"thread_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_mime_type" text,
	"file_size" integer,
	"file_path" text,
	"extracted_text" text,
	"summary_text" text,
	"status" text DEFAULT 'PENDING',
	"source_message_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "document_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"title" text,
	"status" text DEFAULT 'ACTIVE',
	"latest_summary" text,
	"message_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "download_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'PENDING',
	"progress" integer DEFAULT 0,
	"file_size" integer,
	"file_name" text,
	"sandbox_result" text,
	"error_message" text,
	"vault_item_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dream_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dream_type" text NOT NULL,
	"simulation_count" integer DEFAULT 0,
	"decisions_optimized" integer DEFAULT 0,
	"patches_generated" text[],
	"insights_discovered" jsonb,
	"duration_ms" integer,
	"status" text DEFAULT 'SLEEPING',
	"dream_date" timestamp,
	"conversations_processed" integer DEFAULT 0,
	"entities_extracted" integer DEFAULT 0,
	"patterns_found" jsonb,
	"emotional_trend" text,
	"skill_evaluations" jsonb,
	"confidence_adjustments" jsonb,
	"summary" text,
	"learnings" text[],
	"recommendations" text[],
	"related_person_ids" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"imap_host" text,
	"imap_port" integer DEFAULT 993,
	"smtp_host" text,
	"smtp_port" integer DEFAULT 465,
	"encrypted_password" text,
	"password_iv" text,
	"oauth_tokens" jsonb,
	"status" text DEFAULT 'pending',
	"last_error" text,
	"last_sync_at" timestamp,
	"sync_enabled" boolean DEFAULT true,
	"sync_folders" text[] DEFAULT ARRAY['INBOX'],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text,
	"size" integer,
	"content_id" text,
	"storage_path" text,
	"document_type" text,
	"extracted_data" jsonb,
	"ocr_text" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" varchar NOT NULL,
	"message_id" text NOT NULL,
	"thread_id" text,
	"folder" text DEFAULT 'INBOX',
	"subject" text,
	"from_email" text,
	"from_name" text,
	"to_emails" text[],
	"cc_emails" text[],
	"body_text" text,
	"body_html" text,
	"snippet" text,
	"has_attachments" boolean DEFAULT false,
	"attachment_count" integer DEFAULT 0,
	"is_read" boolean DEFAULT false,
	"is_starred" boolean DEFAULT false,
	"is_archived" boolean DEFAULT false,
	"category" text,
	"ai_summary" text,
	"extracted_data" jsonb,
	"importance" text DEFAULT 'normal',
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emotional_memories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_key" text NOT NULL,
	"entity_value" text,
	"original_text" text NOT NULL,
	"extracted_from" text,
	"embedding" text,
	"embedding_model" text DEFAULT 'text-embedding-v2',
	"emotional_weight" real DEFAULT 1,
	"confidence_score" real DEFAULT 0.8,
	"mention_count" integer DEFAULT 1,
	"last_mentioned_at" timestamp,
	"requires_follow_up" integer DEFAULT 0,
	"follow_up_type" text,
	"follow_up_triggered_at" timestamp,
	"expires_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "encrypted_secrets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_type" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"key_fingerprint" text,
	"description" text,
	"last_rotated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "encrypted_secrets_key_type_unique" UNIQUE("key_type")
);
--> statement-breakpoint
CREATE TABLE "event_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"event_id" varchar,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"solution" text,
	"impact_level" text NOT NULL,
	"affected_areas" text[],
	"notification_type" text DEFAULT 'BUBBLE',
	"is_read" boolean DEFAULT false,
	"is_dismissed" boolean DEFAULT false,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_analysis_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"relevance" integer DEFAULT 0,
	"impact_score" integer DEFAULT 0,
	"urgency_score" integer DEFAULT 0,
	"analysis_data" jsonb,
	"user_feedback" text,
	"is_useful" boolean,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "evolution_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_module" text NOT NULL,
	"event_type" text NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"delta_description" text,
	"triggered_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "evolution_state" (
	"id" varchar PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"hp_balance" integer DEFAULT 1000,
	"hp_max_balance" integer DEFAULT 1000,
	"hp_total_consumed" integer DEFAULT 0,
	"hp_total_recharged" integer DEFAULT 0,
	"hp_last_recharge_at" timestamp,
	"academic_level" text DEFAULT 'BACHELOR',
	"academic_xp" integer DEFAULT 0,
	"next_level_xp" integer DEFAULT 1000,
	"local_model_progress" real DEFAULT 0,
	"external_call_count" integer DEFAULT 0,
	"local_call_count" integer DEFAULT 0,
	"distillation_count" integer DEFAULT 0,
	"distilled_knowledge_size" integer DEFAULT 0,
	"total_skill_capsules" integer DEFAULT 0,
	"active_skill_capsules" integer DEFAULT 0,
	"total_dream_sessions" integer DEFAULT 0,
	"total_insights_discovered" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"expense_type" text NOT NULL,
	"travel_request_id" text,
	"travel_request_data" jsonb,
	"total_amount" numeric(12, 2) DEFAULT '0',
	"invoice_count" integer DEFAULT 0,
	"status" text DEFAULT 'draft',
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"approved_by" text,
	"reject_reason" text,
	"ai_summary" text,
	"ai_recommendations" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expert_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expert_type" text NOT NULL,
	"query" text NOT NULL,
	"chain_of_thought" jsonb,
	"recommendation" text,
	"confidence" real DEFAULT 0.5,
	"hp_cost" integer DEFAULT 0,
	"applied_to_z1" integer DEFAULT 0,
	"feedback_score" real,
	"related_person_ids" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "extracted_entities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_value" text NOT NULL,
	"normalized_value" text,
	"context" text,
	"confidence" real DEFAULT 0.5,
	"linked_person_id" varchar,
	"linked_project_id" varchar,
	"auto_created" integer DEFAULT 0,
	"user_confirmed" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "failure_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_type" text NOT NULL,
	"source_module" text,
	"original_query" text,
	"failure_reason" text,
	"user_correction" text,
	"context" jsonb,
	"device_id" text,
	"is_processed" integer DEFAULT 0,
	"processed_at" timestamp,
	"evolution_result" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_access_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"file_path" text NOT NULL,
	"access_type" text NOT NULL,
	"accessed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_aliases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_file_id" varchar NOT NULL,
	"alias_name" text NOT NULL,
	"alias_path" text NOT NULL,
	"source_avatar_id" varchar,
	"source_workspace_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_conflicts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conflict_type" text NOT NULL,
	"file_a_id" varchar NOT NULL,
	"file_b_id" varchar NOT NULL,
	"file_a_path" text,
	"file_b_path" text,
	"file_a_hash" text,
	"file_b_hash" text,
	"similarity_score" real DEFAULT 0,
	"status" text DEFAULT 'PENDING',
	"resolution" text,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"ai_recommendation" text,
	"ai_confidence" real DEFAULT 0,
	"detected_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_index" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_extension" text,
	"file_size" integer DEFAULT 0,
	"mime_type" text,
	"category" text DEFAULT '其他',
	"workspace_id" varchar,
	"owner_avatar_id" varchar,
	"visibility_scope" text DEFAULT 'PERSONAL',
	"content_preview" text,
	"content_hash" text,
	"full_text_index" text,
	"ai_tags" text[],
	"ai_summary" text,
	"ai_keywords" text[],
	"embedding_vector" jsonb,
	"current_version" integer DEFAULT 1,
	"is_latest_version" integer DEFAULT 1,
	"file_created_at" timestamp,
	"file_modified_at" timestamp,
	"last_indexed_at" timestamp DEFAULT now(),
	"index_status" text DEFAULT 'PENDING',
	"error_message" text,
	"access_count" integer DEFAULT 0,
	"last_accessed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_knowledge" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_hash" text,
	"file_size_kb" integer,
	"device_id" text NOT NULL,
	"extracted_text" text,
	"summary" text,
	"key_points" text[],
	"entities" jsonb,
	"contract_parties" text[],
	"contract_value" numeric,
	"contract_terms" jsonb,
	"expiry_date" timestamp,
	"embedding_vector" text,
	"related_contacts" text[],
	"related_chats" text[],
	"category" text,
	"tags" text[],
	"privacy_zone" text DEFAULT 'ZONE_RED',
	"processing_status" text DEFAULT 'PENDING',
	"last_processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_scan_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"scan_path" text NOT NULL,
	"file_hash" text,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" text,
	"category" text,
	"created_at_file" timestamp,
	"modified_at_file" timestamp,
	"accessed_at_file" timestamp,
	"last_scanned_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_index_id" varchar NOT NULL,
	"version_number" integer DEFAULT 1,
	"version_label" text,
	"content_hash" text NOT NULL,
	"file_size" integer DEFAULT 0,
	"change_type" text DEFAULT 'MODIFY',
	"change_summary" text,
	"changed_by" varchar,
	"diff_from_previous" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "finance_knowledge" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"source" text,
	"content" text NOT NULL,
	"category" text NOT NULL,
	"sub_category" text,
	"tags" text[],
	"formula_json" jsonb,
	"embedding" text,
	"embedding_model" text DEFAULT 'bge-small-zh',
	"version" text,
	"effective_date" timestamp,
	"expiry_date" timestamp,
	"is_latest" boolean DEFAULT true,
	"sync_version" integer DEFAULT 1,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "generated_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"file_type" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'DOCUMENT',
	"related_project_id" varchar,
	"related_report_id" varchar,
	"related_person_id" varchar,
	"generated_by" text DEFAULT 'AVATAR',
	"generator_prompt" text,
	"export_formats" text[],
	"download_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "global_config" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"primary_brain" text DEFAULT 'TONGYI',
	"vision_brain" text DEFAULT 'TONGYI',
	"fast_brain" text DEFAULT 'DOUBAO',
	"llm_router_config" jsonb DEFAULT '{}'::jsonb,
	"bot_name" text DEFAULT '小智',
	"personality_prompt" text,
	"interest_keywords" jsonb DEFAULT '[]'::jsonb,
	"hp_cost_chat" integer DEFAULT 2,
	"hp_cost_code_gen" integer DEFAULT 30,
	"hp_cost_intel_analysis" integer DEFAULT 50,
	"hp_cost_vision" integer DEFAULT 15,
	"hp_recovery_rate" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "global_mutex" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mutex_key" text NOT NULL,
	"active_device_id" text,
	"active_device_type" text,
	"active_device_name" text,
	"fencing_token" integer DEFAULT 0 NOT NULL,
	"acquired_at" timestamp,
	"expires_at" timestamp,
	"avatar_pose_json" jsonb,
	"migration_state" text DEFAULT 'IDLE',
	"migration_source_device" text,
	"migration_target_device" text,
	"migration_started_at" timestamp,
	"audio_stream_active" integer DEFAULT 0,
	"audio_stream_device_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "global_mutex_mutex_key_unique" UNIQUE("mutex_key")
);
--> statement-breakpoint
CREATE TABLE "health_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar,
	"device_type" text,
	"heart_rate" integer,
	"hrv" real,
	"blood_oxygen" real,
	"body_temperature" real,
	"bp_systolic" integer,
	"bp_diastolic" integer,
	"steps" integer,
	"distance" real,
	"calories_burned" integer,
	"active_minutes" integer,
	"standing_hours" integer,
	"sleep_duration_minutes" integer,
	"deep_sleep_minutes" integer,
	"light_sleep_minutes" integer,
	"rem_sleep_minutes" integer,
	"awake_minutes" integer,
	"sleep_quality_score" real,
	"stress_level" real,
	"relaxation_score" real,
	"recorded_at" timestamp NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "immune_scans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"scan_type" text NOT NULL,
	"status" text DEFAULT 'RUNNING',
	"apps_scanned" integer DEFAULT 0,
	"threats_found" integer DEFAULT 0,
	"warnings_found" integer DEFAULT 0,
	"overall_health_score" integer DEFAULT 100,
	"memory_health_score" integer DEFAULT 100,
	"storage_health_score" integer DEFAULT 100,
	"battery_health_score" integer DEFAULT 100,
	"privacy_health_score" integer DEFAULT 100,
	"total_memory_mb" integer,
	"used_memory_mb" integer,
	"total_storage_mb" integer,
	"used_storage_mb" integer,
	"cache_cleanable_mb" integer,
	"top_threats" jsonb,
	"recommendations" text[],
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "index_directories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"directory_path" text NOT NULL,
	"directory_name" text NOT NULL,
	"is_recursive" integer DEFAULT 1,
	"is_enabled" integer DEFAULT 1,
	"exclude_patterns" text[],
	"include_extensions" text[],
	"total_files" integer DEFAULT 0,
	"indexed_files" integer DEFAULT 0,
	"last_scan_at" timestamp,
	"watch_for_changes" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "insight_alerts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"type" text NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"suggested_action" text,
	"related_entity_ids" text[],
	"delivered_via" text,
	"delivered_at" timestamp,
	"acknowledged" integer DEFAULT 0,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "insight_entities" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"context" text,
	"confidence" real DEFAULT 0,
	"importance" real DEFAULT 0.5,
	"related_speaker" text,
	"linked_person_id" varchar,
	"linked_organization_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "insight_feedback_channels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"channel_type" text NOT NULL,
	"device_id" text,
	"device_name" text,
	"priority" integer DEFAULT 1,
	"is_available" integer DEFAULT 1,
	"last_connected_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "insight_sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"mode" text DEFAULT 'SILENT' NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"is_active" integer DEFAULT 1,
	"speaker_count" integer DEFAULT 0,
	"transcript_count" integer DEFAULT 0,
	"entity_count" integer DEFAULT 0,
	"alert_count" integer DEFAULT 0,
	"scene_transitions" jsonb,
	"recording_path" text,
	"recording_size" integer,
	"summary" text,
	"key_moments" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "insight_transcripts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"speaker_id" varchar,
	"speaker_name" text,
	"is_master" integer DEFAULT 0,
	"text" text NOT NULL,
	"start_time" real NOT NULL,
	"end_time" real NOT NULL,
	"confidence" real DEFAULT 0,
	"emotion" jsonb,
	"keywords" text[],
	"sensitivity_level" text DEFAULT 'LOW',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "insights_processing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"percent_complete" integer DEFAULT 0,
	"eta_seconds" integer DEFAULT 0,
	"stage" text DEFAULT 'transcription',
	"stage_progress" integer DEFAULT 0,
	"raw_transcript" text,
	"processed_chunks" integer DEFAULT 0,
	"total_chunks" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "inspirations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'MASTER' NOT NULL,
	"type" text DEFAULT 'idea' NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"ai_summary" text,
	"ai_research" jsonb,
	"ai_refined_plan" text,
	"status" text DEFAULT 'draft',
	"related_person_ids" text[],
	"related_project_id" varchar,
	"priority" integer DEFAULT 5,
	"is_read" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider_id" varchar NOT NULL,
	"name" text NOT NULL,
	"encrypted_credentials" text,
	"credentials_iv" text,
	"status" text DEFAULT 'pending',
	"last_connected_at" timestamp,
	"last_error" text,
	"config" jsonb,
	"sync_enabled" text DEFAULT 'false',
	"sync_interval" integer DEFAULT 3600,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_providers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"category" text NOT NULL,
	"icon" text,
	"description" text,
	"config_schema" jsonb,
	"capabilities" text[],
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "integration_providers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "integration_sync_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" varchar NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'pending',
	"started_at" timestamp,
	"completed_at" timestamp,
	"items_processed" integer DEFAULT 0,
	"items_failed" integer DEFAULT 0,
	"error_log" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intel_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"source" text,
	"category" text DEFAULT 'GENERAL',
	"status" text DEFAULT 'PENDING',
	"related_person_id" varchar,
	"related_project_id" varchar,
	"risk_level" text DEFAULT 'LOW',
	"ai_summary" text,
	"ai_recommendation" text,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"invoice_no" text,
	"invoice_code" text,
	"invoice_type" text,
	"amount" numeric(12, 2),
	"tax_amount" numeric(12, 2),
	"total_amount" numeric(12, 2),
	"seller_name" text,
	"seller_tax_no" text,
	"buyer_name" text,
	"buyer_tax_no" text,
	"items" jsonb,
	"invoice_date" timestamp,
	"image_path" text,
	"pdf_path" text,
	"status" text DEFAULT 'pending',
	"verification_result" jsonb,
	"expense_report_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_execution_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" varchar(50) NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"status" varchar(20) NOT NULL,
	"result" jsonb,
	"error_message" text,
	"error_stack" text,
	"attempt_number" integer DEFAULT 1,
	"will_retry" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kill_switch_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" varchar,
	"target_name" text,
	"reason" text NOT NULL,
	"severity" text DEFAULT 'MEDIUM',
	"initiated_by" text DEFAULT 'MASTER',
	"authorized_by" text,
	"data_destroyed" boolean DEFAULT false,
	"permissions_revoked" boolean DEFAULT false,
	"device_locked" boolean DEFAULT false,
	"affected_modules" text[],
	"affected_data" jsonb,
	"reversible" boolean DEFAULT true,
	"reversed_at" timestamp,
	"reversed_by" text,
	"executed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_sync_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar NOT NULL,
	"device_type" text,
	"sync_type" text NOT NULL,
	"knowledge_type" text NOT NULL,
	"status" text DEFAULT 'PENDING',
	"items_count" integer DEFAULT 0,
	"bytes_transferred" integer DEFAULT 0,
	"from_version" integer,
	"to_version" integer,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "learned_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_name" text NOT NULL,
	"pattern_code" text,
	"category" text NOT NULL,
	"sub_category" text,
	"description" text NOT NULL,
	"core_logic" text,
	"applicable_scenarios" text[],
	"prerequisites" text[],
	"contraindications" text[],
	"action_steps" jsonb,
	"recommended_actions" text[],
	"success_probability" real,
	"confidence_score" real,
	"derived_from_cases" text[],
	"case_count" integer DEFAULT 1,
	"version" integer DEFAULT 1,
	"sync_status" text DEFAULT 'PENDING',
	"last_sync_at" timestamp,
	"usage_count" integer DEFAULT 0,
	"feedback_score" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learned_skills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_name" text NOT NULL,
	"description" text,
	"category" text,
	"trigger_patterns" text[],
	"steps" jsonb,
	"expected_output" text,
	"learned_from" text,
	"source_conversation_id" varchar,
	"usage_count" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"last_used_at" timestamp,
	"is_active" integer DEFAULT 1,
	"confidence" real DEFAULT 0.5,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legal_index" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"law_code" text NOT NULL,
	"law_name" text NOT NULL,
	"category" text NOT NULL,
	"sub_category" text,
	"publish_authority" text,
	"publish_date" timestamp,
	"effective_date" timestamp,
	"expiry_date" timestamp,
	"source" text,
	"source_url" text,
	"summary" text,
	"keywords" text[],
	"article_count" integer,
	"is_downloaded" boolean DEFAULT false,
	"downloaded_at" timestamp,
	"download_size" integer,
	"knowledge_ids" text[],
	"hit_count" integer DEFAULT 0,
	"last_accessed_at" timestamp,
	"priority" integer DEFAULT 5,
	"version" text DEFAULT '1.0',
	"is_latest" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legal_knowledge" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"law_name" text NOT NULL,
	"article_number" text,
	"chapter_section" text,
	"content" text NOT NULL,
	"category" text NOT NULL,
	"tags" text[],
	"embedding" text,
	"embedding_model" text DEFAULT 'bge-small-zh',
	"version" text,
	"effective_date" timestamp,
	"is_latest" boolean DEFAULT true,
	"related_cases" text[],
	"sync_version" integer DEFAULT 1,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "location_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_name" text NOT NULL,
	"location_type" text,
	"latitude" real,
	"longitude" real,
	"address" text,
	"visit_count" integer DEFAULT 1,
	"total_duration_minutes" integer DEFAULT 0,
	"avg_duration_minutes" integer DEFAULT 0,
	"typical_arrival_time" text,
	"typical_departure_time" text,
	"weekday_visits" integer DEFAULT 0,
	"weekend_visits" integer DEFAULT 0,
	"associated_activities" text[],
	"associated_contacts" text[],
	"energy_impact" integer DEFAULT 0,
	"productivity_score" integer DEFAULT 50,
	"last_visit" timestamp,
	"first_visit" timestamp,
	"is_frequent" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "location_visits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_id" varchar,
	"arrival_time" timestamp NOT NULL,
	"departure_time" timestamp,
	"duration_minutes" integer,
	"day_of_week" integer,
	"pre_visit_energy" integer,
	"post_visit_energy" integer,
	"activities" text[],
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loyalty_authorizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"master_user_id" varchar NOT NULL,
	"original_master_user_id" varchar,
	"loyalty_level" integer DEFAULT 100,
	"trust_depth" text DEFAULT 'ABSOLUTE',
	"authorization_type" text DEFAULT 'ORIGIN',
	"transferred_from" varchar,
	"transfer_reason" text,
	"transferred_at" timestamp,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loyalty_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" varchar,
	"member_name" text,
	"event_type" text NOT NULL,
	"event_category" text DEFAULT 'OBSERVATION',
	"description" text,
	"evidence_data" jsonb,
	"severity_score" real DEFAULT 0.5,
	"confidence_score" real DEFAULT 0.5,
	"trigger_keywords" text[],
	"related_events" text[],
	"risk_indicators" jsonb,
	"predicted_action" text,
	"suggested_intervention" text,
	"status" text DEFAULT 'DETECTED',
	"handled_by" text,
	"handled_at" timestamp,
	"resolution_notes" text,
	"detected_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meal_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_type" text NOT NULL,
	"description" text NOT NULL,
	"estimated_calories" integer DEFAULT 0,
	"protein" real,
	"carbs" real,
	"fat" real,
	"fiber" real,
	"sugar" real,
	"sodium" real,
	"caffeine_mg" real,
	"alcohol_units" real,
	"water_ml" integer,
	"location" text,
	"mood" text,
	"tags" text[],
	"recorded_date" text NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "migration_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"migration_id" text NOT NULL,
	"source_device_id" text,
	"source_device_name" text,
	"target_device_id" text NOT NULL,
	"target_device_name" text NOT NULL,
	"status" text NOT NULL,
	"fencing_token_before" integer,
	"fencing_token_after" integer,
	"avatar_pose_snapshot" jsonb,
	"transition_phrase" text,
	"kill_sent_at" timestamp,
	"kill_ack_at" timestamp,
	"token_released_at" timestamp,
	"token_granted_at" timestamp,
	"duration_ms" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monitored_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"content" text,
	"source" text,
	"source_url" text,
	"publish_date" timestamp,
	"effective_date" timestamp,
	"category" text,
	"tags" text[],
	"impact_level" text DEFAULT 'LOW',
	"affected_areas" text[],
	"impact_description" text,
	"solution" text,
	"action_items" jsonb,
	"status" text DEFAULT 'NEW',
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "morning_gifts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gift_date" timestamp NOT NULL,
	"evolution_summary" text,
	"evolution_details" jsonb,
	"opportunities" jsonb,
	"risks" jsonb,
	"secret_weapons" jsonb,
	"today_focus" text[],
	"prepared_actions" jsonb,
	"performance_boost" text,
	"new_capabilities" text[],
	"is_read" integer DEFAULT 0,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nutrition_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_calories" integer DEFAULT 2000,
	"protein_grams" integer DEFAULT 60,
	"carbs_grams" integer DEFAULT 250,
	"fat_grams" integer DEFAULT 65,
	"fiber_grams" integer DEFAULT 25,
	"water_ml" integer DEFAULT 2500,
	"caffeine_limit" integer DEFAULT 400,
	"alcohol_limit" integer DEFAULT 2,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"priority" text DEFAULT 'MEDIUM',
	"status" text DEFAULT 'DETECTED',
	"estimated_value" real,
	"value_currency" text DEFAULT 'CNY',
	"confidence_score" real DEFAULT 0.5,
	"related_signal_ids" text[],
	"related_person_ids" text[],
	"related_project_ids" text[],
	"detected_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"ai_analysis" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "opportunity_signals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"opportunity_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"estimated_value" real,
	"currency" text DEFAULT 'CNY',
	"probability" real DEFAULT 0.5,
	"urgency" text DEFAULT 'MEDIUM',
	"related_person_ids" text[],
	"related_project_id" varchar,
	"key_insights" text[],
	"suggested_actions" text[],
	"status" text DEFAULT 'DETECTED',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "personality_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"active_persona" text DEFAULT 'DAUGHTER',
	"medium_mode" text DEFAULT 'PRIVATE',
	"current_device" text,
	"emotion_state" text DEFAULT 'WARM',
	"emotion_intensity" real DEFAULT 0.7,
	"is_professional_mode" integer DEFAULT 0,
	"third_party_present" integer DEFAULT 0,
	"environment_context" jsonb,
	"last_activity_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"organization" text,
	"tags" text[],
	"weakness" text,
	"interest_chain" jsonb,
	"decision_style" text,
	"decision_dna" text,
	"last_interaction" timestamp,
	"connection_nodes" text[],
	"bond_strength" real DEFAULT 0.5,
	"conflict_points" text[],
	"access_level" text DEFAULT 'ZONE_BLUE',
	"approval_status" text DEFAULT 'PENDING',
	"added_by" text DEFAULT 'AI',
	"capabilities" text[],
	"capability_level" jsonb,
	"specialties" text[],
	"capability_indexed_at" timestamp,
	"response_pattern" jsonb,
	"commitment_rate" real DEFAULT 0.5,
	"negotiation_style" text,
	"historical_decisions" jsonb,
	"predicted_behaviors" jsonb,
	"risk_factors" jsonb,
	"last_prediction_update" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proactive_care_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" varchar NOT NULL,
	"rule_name" text,
	"trigger_type" text NOT NULL,
	"trigger_data" jsonb,
	"action_type" text NOT NULL,
	"action_result" text DEFAULT 'PENDING',
	"message" text,
	"target_person_id" varchar,
	"user_response" text,
	"responded_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proactive_care_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" text NOT NULL,
	"trigger_condition" jsonb NOT NULL,
	"action_type" text NOT NULL,
	"action_config" jsonb,
	"priority" text DEFAULT 'MEDIUM',
	"cooldown_hours" integer DEFAULT 24,
	"last_triggered_at" timestamp,
	"is_enabled" boolean DEFAULT true,
	"is_system_rule" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text DEFAULT 'OTHER',
	"file_size" integer,
	"file_path" text,
	"file_content" text,
	"ai_analysis" text,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" varchar,
	"actor_id" varchar,
	"actor_name" text,
	"actor_type" text DEFAULT 'USER',
	"previous_value" jsonb,
	"new_value" jsonb,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0,
	"status" text DEFAULT 'PENDING',
	"progress" integer DEFAULT 0,
	"planned_start_date" timestamp,
	"planned_end_date" timestamp,
	"actual_start_date" timestamp,
	"actual_end_date" timestamp,
	"estimated_days" integer,
	"actual_days" integer,
	"deliverables" text[],
	"dependencies" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"content" text NOT NULL,
	"note_type" text DEFAULT 'GENERAL',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_risks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'GENERAL',
	"probability" text DEFAULT 'MEDIUM',
	"impact" text DEFAULT 'MEDIUM',
	"risk_score" integer DEFAULT 5,
	"status" text DEFAULT 'IDENTIFIED',
	"mitigation" text,
	"contingency" text,
	"owner_id" varchar,
	"owner_name" text,
	"identified_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"resolution_notes" text,
	"ai_identified" integer DEFAULT 0,
	"ai_analysis" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"milestone_id" varchar,
	"parent_task_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0,
	"status" text DEFAULT 'TODO',
	"priority" text DEFAULT 'MEDIUM',
	"assignee_id" varchar,
	"assignee_name" text,
	"estimated_hours" real,
	"actual_hours" real,
	"due_date" timestamp,
	"completed_at" timestamp,
	"tags" text[],
	"attachments" jsonb,
	"ai_generated" integer DEFAULT 0,
	"ai_confidence" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'SOP',
	"template_data" jsonb NOT NULL,
	"is_public" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'BUSINESS',
	"status" text DEFAULT 'PENDING_REVIEW',
	"priority" integer DEFAULT 5,
	"leader_id" varchar,
	"responsible_person_id" varchar,
	"related_person_ids" text[],
	"executor_ids" text[],
	"related_intel_ids" text[],
	"current_conditions" text[],
	"missing_conditions" text[],
	"swot_analysis" jsonb,
	"legal_analysis" jsonb,
	"finance_analysis" jsonb,
	"strategy_analysis" jsonb,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promise_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promise_content" text NOT NULL,
	"promise_type" text DEFAULT 'TASK',
	"assessment_id" varchar,
	"status" text DEFAULT 'ACTIVE',
	"progress_percent" integer DEFAULT 0,
	"deadline_at" timestamp,
	"estimated_completion_at" timestamp,
	"risk_level" text DEFAULT 'NONE',
	"risk_description" text,
	"prewarning_at" timestamp,
	"execution_log" jsonb,
	"completed_at" timestamp,
	"completion_quality" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "psych_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" varchar NOT NULL,
	"personality_type" text,
	"dominant_traits" text[],
	"communication_style" text,
	"facial_analysis" text,
	"emotional_tendency" text,
	"trustworthiness_score" real,
	"decision_making_style" text,
	"stress_response" text,
	"motivation_drivers" text[],
	"approach_suggestions" text,
	"avoid_behaviors" text,
	"source_type" text DEFAULT 'PHOTO',
	"confidence_level" real DEFAULT 0.6,
	"analysis_version" integer DEFAULT 1,
	"manual_corrections" jsonb,
	"last_observation_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rag_knowledge" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source_failure_id" varchar,
	"confidence" real DEFAULT 0.5,
	"usage_count" integer DEFAULT 0,
	"success_rate" real DEFAULT 1,
	"embedding" text,
	"keywords" text[],
	"is_active" integer DEFAULT 1,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refinement_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" varchar NOT NULL,
	"run_type" text DEFAULT 'DREAM',
	"status" text DEFAULT 'PENDING',
	"input_context" jsonb,
	"simulation_steps" jsonb,
	"conclusions" jsonb,
	"hp_consumed" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "relation_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar NOT NULL,
	"target_type" text NOT NULL,
	"target_id" varchar NOT NULL,
	"link_type" text NOT NULL,
	"confidence" real DEFAULT 0.8,
	"description" text,
	"evidence" text,
	"is_conflict" boolean DEFAULT false,
	"conflict_severity" text,
	"resolved" boolean DEFAULT false,
	"detected_by" text DEFAULT 'AI',
	"reviewed_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "relationship_edges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_person_id" varchar NOT NULL,
	"to_person_id" varchar NOT NULL,
	"relationship_type" text NOT NULL,
	"strength" real DEFAULT 0.5,
	"last_interaction" timestamp,
	"interaction_count" integer DEFAULT 0,
	"sentiment_avg" real DEFAULT 0,
	"notes" text,
	"tags" text[],
	"metadata" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "relationship_suggestions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" varchar NOT NULL,
	"suggestion_type" text NOT NULL,
	"message" text NOT NULL,
	"priority" text DEFAULT 'MEDIUM',
	"due_date" timestamp,
	"status" text DEFAULT 'PENDING',
	"dismissed_at" timestamp,
	"completed_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "remediation_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" varchar,
	"device_id" text NOT NULL,
	"action_type" text NOT NULL,
	"target_app" text NOT NULL,
	"target_package" text,
	"reason" text NOT NULL,
	"severity" text DEFAULT 'MEDIUM',
	"status" text DEFAULT 'PENDING',
	"approved_by" text,
	"executed_via" text,
	"result" jsonb,
	"error_message" text,
	"memory_freed_mb" integer,
	"storage_freed_mb" integer,
	"requested_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"executed_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reminder_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" varchar,
	"title" text NOT NULL,
	"content" text,
	"trigger_type" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'PENDING',
	"delivered_at" timestamp,
	"read_at" timestamp,
	"dismissed_at" timestamp,
	"snoozed_until" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reminder_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"rule_type" text NOT NULL,
	"trigger_type" text DEFAULT 'TIME',
	"entity_type" text,
	"entity_id" varchar,
	"trigger_config" jsonb,
	"advance_minutes" integer DEFAULT 15,
	"priority" text DEFAULT 'NORMAL',
	"channel" text DEFAULT 'PUSH',
	"enabled" boolean DEFAULT true,
	"last_triggered_at" timestamp,
	"next_trigger_at" timestamp,
	"trigger_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "remote_commands" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar NOT NULL,
	"command_type" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'PENDING',
	"result_payload" jsonb,
	"error_message" text,
	"issued_by" text NOT NULL,
	"issued_at" timestamp DEFAULT now(),
	"acknowledged_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "routing_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_id" varchar,
	"message_preview" text,
	"task_type" text NOT NULL,
	"sensitivity_level" text NOT NULL,
	"sensitive_categories" text[],
	"selected_provider" text NOT NULL,
	"selected_model" text,
	"routing_reason" text,
	"fallback_used" integer DEFAULT 0,
	"fallback_chain" text[],
	"classification_latency_ms" integer,
	"routing_latency_ms" integer,
	"total_latency_ms" integer,
	"hp_cost" integer DEFAULT 0,
	"hp_balance_after" integer,
	"user_preference" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "satellite_devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"device_name" text NOT NULL,
	"device_type" text NOT NULL,
	"owner_id" varchar,
	"owner_name" text,
	"status" text DEFAULT 'OFFLINE',
	"connection_type" text DEFAULT 'WEBSOCKET',
	"last_heartbeat" timestamp,
	"access_tier" text DEFAULT 'BASIC',
	"allowed_modules" text[],
	"blocked_modules" text[],
	"sync_enabled" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"pending_updates" integer DEFAULT 0,
	"kill_switch_active" boolean DEFAULT false,
	"kill_switch_reason" text,
	"kill_switch_at" timestamp,
	"ip_address" text,
	"location" text,
	"os_info" text,
	"app_version" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "satellite_devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "scene_recognition_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"detected_scene" text NOT NULL,
	"confidence" real DEFAULT 0.5,
	"trigger_type" text,
	"trigger_data" jsonb,
	"suggested_mode" text,
	"mode_applied" boolean DEFAULT false,
	"detected_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "schedule_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forced_offline_enabled" boolean DEFAULT true,
	"forced_offline_start" text DEFAULT '22:00',
	"forced_offline_end" text DEFAULT '07:00',
	"max_work_hours_per_day" integer DEFAULT 10,
	"min_break_minutes" integer DEFAULT 60,
	"health_priority_level" integer DEFAULT 8,
	"auto_insert_rest_breaks" boolean DEFAULT true,
	"rest_break_interval_minutes" integer DEFAULT 90,
	"rest_break_duration_minutes" integer DEFAULT 15,
	"fatigue_aware_scheduling" boolean DEFAULT true,
	"low_energy_meeting_block" boolean DEFAULT true,
	"sleep_protection_enabled" boolean DEFAULT true,
	"target_sleep_hours" integer DEFAULT 7,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheduled_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" varchar(50) NOT NULL,
	"job_name" varchar(100) NOT NULL,
	"description" text,
	"cron_expression" varchar(50) NOT NULL,
	"timezone" varchar(50) DEFAULT 'Asia/Shanghai',
	"status" varchar(20) DEFAULT 'active',
	"enabled" boolean DEFAULT true,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"last_result" varchar(20),
	"last_error" text,
	"total_runs" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"retry_delay_ms" integer DEFAULT 60000,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "scheduled_jobs_job_type_unique" UNIQUE("job_type")
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"search_type" text DEFAULT 'keyword',
	"result_count" integer DEFAULT 0,
	"top_result_ids" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shadow_memories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"context" text NOT NULL,
	"choice_made" text NOT NULL,
	"rejected_options" text[],
	"mimicry_weight" real DEFAULT 0.5,
	"field" text,
	"exp_points" integer DEFAULT 0,
	"unlocked_skills" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skill_capsules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"skill_code" text,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"dependencies" jsonb DEFAULT '{}'::jsonb,
	"pip_mirror" text DEFAULT 'https://pypi.tuna.tsinghua.edu.cn/simple',
	"npm_mirror" text DEFAULT 'https://registry.npmmirror.com',
	"language" text DEFAULT 'python',
	"entry_point" text,
	"learned_from" text,
	"is_active" integer DEFAULT 1,
	"version" text DEFAULT '1.0.0',
	"usage_count" integer DEFAULT 0,
	"success_rate" real DEFAULT 1,
	"sandbox_required" integer DEFAULT 1,
	"permissions_required" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skill_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar,
	"message_id" varchar,
	"skill_id" varchar,
	"feedback_type" text NOT NULL,
	"user_message" text,
	"assistant_response" text,
	"category" text,
	"followup_count" integer DEFAULT 0,
	"was_adopted" integer DEFAULT 0,
	"sentiment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skill_proficiency_curve" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"date" date NOT NULL,
	"total_interactions" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"like_count" integer DEFAULT 0,
	"dislike_count" integer DEFAULT 0,
	"adoption_rate" real DEFAULT 0,
	"avg_followup_count" real DEFAULT 0,
	"proficiency_score" real DEFAULT 0.5,
	"confidence_level" real DEFAULT 0.5,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_graph_edges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_node_id" varchar,
	"target_node_id" varchar,
	"relation_type" text NOT NULL,
	"strength" real DEFAULT 0.5,
	"interaction_count" integer DEFAULT 0,
	"last_interaction" timestamp,
	"sentiment" text DEFAULT 'NEUTRAL',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_graph_nodes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" varchar,
	"node_type" text NOT NULL,
	"label" text NOT NULL,
	"influence" real DEFAULT 0.5,
	"centrality" real DEFAULT 0.5,
	"cluster" text,
	"risk_level" text DEFAULT 'LOW',
	"risk_factors" text[],
	"pos_x" real,
	"pos_y" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_identity_index" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recognized_name" text,
	"recognized_title" text,
	"recognized_voiceprint" text,
	"person_id" varchar,
	"identity_status" text DEFAULT 'UNKNOWN',
	"first_encounter_context" jsonb,
	"authorized_by_master" integer DEFAULT 0,
	"authorization_level" text DEFAULT 'NONE',
	"activation_phrase" text,
	"encounter_count" integer DEFAULT 1,
	"last_encounter_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_interactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_hash" varchar,
	"contact_alias" text,
	"contact_category" text,
	"relationship_importance" integer,
	"interaction_type" text NOT NULL,
	"direction" text,
	"duration_seconds" integer,
	"emotional_impact" text,
	"emotion_score" real,
	"stress_contribution" real,
	"communication_quality" real,
	"was_productive" boolean,
	"context_tags" text[],
	"location_category" text,
	"occurred_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strategy_proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" varchar NOT NULL,
	"refinement_run_id" varchar,
	"title" text NOT NULL,
	"summary" text,
	"proposal_type" text DEFAULT 'ACTION',
	"urgency" text DEFAULT 'NORMAL',
	"recommended_actions" jsonb,
	"alternative_options" jsonb,
	"estimated_roi" real,
	"risk_assessment" jsonb,
	"status" text DEFAULT 'PENDING',
	"presented_at" timestamp,
	"user_decision" text,
	"user_feedback" text,
	"decision_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "swarm_audit_logs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"entity_id" varchar,
	"token_id" varchar,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"outcome" text NOT NULL,
	"details" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "swarm_entities" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"parent_id" varchar,
	"owner_id" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"permissions" jsonb,
	"capabilities" text[],
	"metadata" jsonb,
	"expires_at" timestamp,
	"last_active_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "swarm_team_insights" (
	"id" varchar PRIMARY KEY NOT NULL,
	"team_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" text NOT NULL,
	"generated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "swarm_teams" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"leader_entity_id" varchar NOT NULL,
	"members" jsonb,
	"aggregated_stats" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "swarm_tokens" (
	"id" varchar PRIMARY KEY NOT NULL,
	"entity_id" varchar NOT NULL,
	"token" text NOT NULL,
	"type" text NOT NULL,
	"permissions" text[],
	"issued_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0,
	"max_usage" integer,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "swarm_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "talk_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"talk_type" text DEFAULT 'UNKNOWN',
	"talk_type_confidence" real DEFAULT 0,
	"status" text DEFAULT 'LISTENING',
	"language" text DEFAULT 'zh-CN',
	"device_id" text,
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp,
	"duration_seconds" integer DEFAULT 0,
	"summary" text,
	"key_points" text[],
	"action_items" text[],
	"sentiment" text DEFAULT 'NEUTRAL',
	"extracted_person_count" integer DEFAULT 0,
	"extracted_project_count" integer DEFAULT 0,
	"opportunity_count" integer DEFAULT 0,
	"raw_transcript" text,
	"ai_analysis" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_capability_index" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capability" text NOT NULL,
	"category" text NOT NULL,
	"person_ids" text[],
	"person_names" text[],
	"total_count" integer DEFAULT 0,
	"avg_level" real DEFAULT 0,
	"related_capabilities" text[],
	"keywords" text[],
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" varchar,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"department" text,
	"access_tier" text DEFAULT 'BASIC',
	"custom_permissions" text[],
	"industry_knowledge" text[],
	"capability_scores" jsonb,
	"strengths" text[],
	"weaknesses" text[],
	"best_use_cases" text[],
	"loyalty_score" real DEFAULT 1,
	"privacy_tier" text DEFAULT 'GREEN',
	"risk_flags" text[],
	"last_active_at" timestamp,
	"total_contributions" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tidying_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"task_type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"target_path" text,
	"actions" jsonb DEFAULT '[]'::jsonb,
	"result" jsonb,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "unified_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"aliases" text[],
	"phone" text[],
	"email" text[],
	"wechat_id" text,
	"dingding_id" text,
	"sources" jsonb,
	"role" text,
	"organization" text,
	"department" text,
	"importance" integer DEFAULT 50,
	"trust_score" integer DEFAULT 50,
	"last_interaction" timestamp,
	"interaction_count" integer DEFAULT 0,
	"average_response_time" integer,
	"initiated_by_me" integer DEFAULT 0,
	"initiated_by_them" integer DEFAULT 0,
	"tags" text[],
	"notes" text,
	"privacy_zone" text DEFAULT 'ZONE_BLUE',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "upgrade_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"target_module" text NOT NULL,
	"description" text,
	"change_log" text[],
	"package_url" text,
	"package_hash" text,
	"package_size_mb" real,
	"status" text DEFAULT 'PENDING',
	"deployed_devices" text[],
	"success_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"released_at" timestamp,
	"created_by" text DEFAULT 'DREAM_EVOLUTION'
);
--> statement-breakpoint
CREATE TABLE "uploaded_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"description" text,
	"document_type" text NOT NULL,
	"category" text,
	"total_pages" integer DEFAULT 1,
	"total_files" integer DEFAULT 1,
	"status" text DEFAULT 'PENDING',
	"processing_progress" integer DEFAULT 0,
	"extracted_text" text,
	"structured_data" jsonb,
	"ai_analysis" jsonb,
	"tags" text[],
	"related_project_id" varchar,
	"related_person_id" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_event_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"interested_categories" text[],
	"interested_event_types" text[],
	"followed_industries" text[],
	"followed_companies" text[],
	"notify_enabled" boolean DEFAULT true,
	"notify_types" text[],
	"min_impact_level" text DEFAULT 'MEDIUM',
	"active_hours_start" text DEFAULT '09:00',
	"active_hours_end" text DEFAULT '22:00',
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_routing_preferences" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"routing_mode" text DEFAULT 'BALANCED',
	"force_local_for_sensitive" integer DEFAULT 1,
	"sensitivity_threshold" text DEFAULT 'MEDIUM',
	"custom_sensitive_keywords" text[],
	"preferred_provider" text,
	"blocked_providers" text[],
	"max_latency_ms" integer DEFAULT 5000,
	"enable_fallback" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"real_name" text,
	"avatar_name" text DEFAULT '小智',
	"avatar_emoji" text DEFAULT '🤖',
	"wake_words" text[] DEFAULT ARRAY['小智', '小智小智'],
	"primary_wake_word" text DEFAULT '小智',
	"wake_word_sensitivity" real DEFAULT 0.8,
	"voice_enabled" text DEFAULT 'true',
	"voice_gender" text DEFAULT 'female',
	"voice_speed" real DEFAULT 1,
	"notification_level" text DEFAULT 'important',
	"auto_analyze" text DEFAULT 'true',
	"screen_monitor_interval" integer DEFAULT 1000,
	"expert_mode" text DEFAULT 'LV5',
	"preferred_language" text DEFAULT 'zh-CN',
	"hp_balance" integer DEFAULT 1000,
	"hp_max_balance" integer DEFAULT 1000,
	"hp_total_consumed" integer DEFAULT 0,
	"hp_total_recharged" integer DEFAULT 0,
	"hp_last_recharge_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vault_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text,
	"file_hash" text,
	"source_url" text,
	"sandbox_status" text DEFAULT 'PENDING',
	"semantic_tags" text[],
	"semantic_index" text,
	"download_node" text DEFAULT 'SERVER_01',
	"privacy_zone" text DEFAULT 'ZONE_GREEN',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vision_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_type" text NOT NULL,
	"pattern_name" text NOT NULL,
	"description" text,
	"recognition_rules" jsonb,
	"extraction_template" text,
	"sample_image_paths" text[],
	"training_count" integer DEFAULT 0,
	"accuracy" real DEFAULT 0.5,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_authorizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_type" text NOT NULL,
	"target" text NOT NULL,
	"scope" text,
	"granted_by" text NOT NULL,
	"expires_at" timestamp,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voiceprints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" text DEFAULT 'MASTER',
	"feature_vector" jsonb,
	"sample_hashes" text[],
	"sample_count" integer DEFAULT 0,
	"confidence_threshold" real DEFAULT 0.75,
	"is_active" integer DEFAULT 1,
	"last_verified" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar NOT NULL,
	"avatar_id" varchar NOT NULL,
	"member_role" text DEFAULT 'MEMBER',
	"can_read" integer DEFAULT 1,
	"can_write" integer DEFAULT 1,
	"can_delete" integer DEFAULT 0,
	"can_share" integer DEFAULT 0,
	"can_manage_members" integer DEFAULT 0,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"workspace_type" text DEFAULT 'PERSONAL',
	"owner_id" varchar NOT NULL,
	"owner_role" text DEFAULT 'MASTER',
	"storage_quota_bytes" integer DEFAULT 1073741824,
	"storage_used_bytes" integer DEFAULT 0,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_source_device_id_satellite_devices_id_fk" FOREIGN KEY ("source_device_id") REFERENCES "public"."satellite_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_source_member_id_team_members_id_fk" FOREIGN KEY ("source_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_emotion_logs" ADD CONSTRAINT "call_emotion_logs_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_extracts" ADD CONSTRAINT "chat_extracts_contact_id_unified_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."unified_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_biometrics" ADD CONSTRAINT "contact_biometrics_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_alerts" ADD CONSTRAINT "event_alerts_event_id_monitored_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."monitored_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_visits" ADD CONSTRAINT "location_visits_pattern_id_location_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."location_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_events" ADD CONSTRAINT "loyalty_events_member_id_team_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psych_profiles" ADD CONSTRAINT "psych_profiles_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_actions" ADD CONSTRAINT "remediation_actions_scan_id_immune_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."immune_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satellite_devices" ADD CONSTRAINT "satellite_devices_owner_id_team_members_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_graph_edges" ADD CONSTRAINT "social_graph_edges_source_node_id_social_graph_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."social_graph_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_graph_edges" ADD CONSTRAINT "social_graph_edges_target_node_id_social_graph_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."social_graph_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_graph_nodes" ADD CONSTRAINT "social_graph_nodes_contact_id_unified_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."unified_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swarm_team_insights" ADD CONSTRAINT "swarm_team_insights_team_id_swarm_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."swarm_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swarm_teams" ADD CONSTRAINT "swarm_teams_leader_entity_id_swarm_entities_id_fk" FOREIGN KEY ("leader_entity_id") REFERENCES "public"."swarm_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swarm_tokens" ADD CONSTRAINT "swarm_tokens_entity_id_swarm_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."swarm_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;