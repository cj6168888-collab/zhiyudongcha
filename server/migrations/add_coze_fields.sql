-- 迁移脚本：为 user_settings 表添加 Coze API 配置字段
-- 执行时间: 2026-04-19

-- 添加 Coze API 配置字段
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coze_api_key TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coze_bot_id TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coze_workflow_id TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coze_enabled TEXT DEFAULT 'false';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coze_workflow_doc_format TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coze_workflow_doc_polish TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coze_workflow_doc_translate TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coze_workflow_doc_summarize TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coze_workflow_ppt TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coze_workflow_report TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coze_workflow_code_review TEXT;

-- 添加注释
COMMENT ON COLUMN user_settings.coze_api_key IS '扣子API密钥';
COMMENT ON COLUMN user_settings.coze_bot_id IS '扣子Bot ID';
COMMENT ON COLUMN user_settings.coze_workflow_id IS '扣子默认工作流ID';
COMMENT ON COLUMN user_settings.coze_enabled IS '是否启用扣子API';
COMMENT ON COLUMN user_settings.coze_workflow_doc_format IS '文档排版工作流ID';
COMMENT ON COLUMN user_settings.coze_workflow_doc_polish IS '文档润色工作流ID';
COMMENT ON COLUMN user_settings.coze_workflow_doc_translate IS '文档翻译工作流ID';
COMMENT ON COLUMN user_settings.coze_workflow_doc_summarize IS '文档摘要工作流ID';
COMMENT ON COLUMN user_settings.coze_workflow_ppt IS 'PPT生成工作流ID';
COMMENT ON COLUMN user_settings.coze_workflow_report IS '报告生成工作流ID';
COMMENT ON COLUMN user_settings.coze_workflow_code_review IS '代码审查工作流ID';

-- 完成
SELECT 'Coze API fields added successfully' AS status;
