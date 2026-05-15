import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIRECT_CLOUD_MODEL_URL = /dashscope\.aliyuncs\.com|api\.deepseek\.com|ark\.cn-beijing\.volces\.com/;

const BASELINE_FILES = [
  'server/lib/ai-provider.ts',
  'server/routes/expenses.ts',
  'server/routes/projects/ai-helpers.ts',
  'server/routes/projects/swot.ts',
  'server/routes/screen-analyze.ts',
  'server/services/ComputeService.ts',
  'server/services/ai-conversation-service.ts',
  'server/services/alibaba-asr.ts',
  'server/services/avatar-recognition.ts',
  'server/services/contact-recognition.ts',
  'server/services/continuous-audio.ts',
  'server/services/cross-platform-context.ts',
  'server/services/dashscope-enhanced.ts',
  'server/services/dashscope.ts',
  'server/services/document-decoder.ts',
  'server/services/email-intelligence.ts',
  'server/services/emotional-memory.ts',
  'server/services/entity-extractor.ts',
  'server/services/expert-ai.ts',
  'server/services/face-compare.ts',
  'server/services/inmo-bridge.ts',
  'server/services/interface-x.ts',
  'server/services/llm-providers/deepseek-provider.ts',
  'server/services/llm-providers/doubao-provider.ts',
  'server/services/llm-providers/tongyi-provider.ts',
  'server/services/mcp-protocol.ts',
  'server/services/omni-archive/chat-cleaner.ts',
  'server/services/omni-archive/file-indexer.ts',
  'server/services/omni-archive/relation-mapper.ts',
  'server/services/oracle-predictor.ts',
  'server/services/perception-core.ts',
  'server/services/professional-knowledge.ts',
  'server/services/psych-profiler.ts',
  'server/services/rag-knowledge.ts',
  'server/services/realtime-voice.ts',
  'server/services/screen-piercer.ts',
  'server/services/strategist-orchestrator.ts',
  'server/services/streaming-tts.ts',
  'server/services/talk-analyzer.ts',
  'server/services/task-extractor.ts',
  'server/services/tidying-up/rename-engine.ts',
  'server/services/tidying-up/semantic-analyzer.ts',
  'server/services/vllm-grounding.ts',
  'server/services/voice-synthesis.ts',
  'server/services/zero-hallucination.ts',
].sort();

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const serverRoot = path.join(repoRoot, 'server');

function collectTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const absolute = path.join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      if (entry === 'tests') {
        continue;
      }
      files.push(...collectTypeScriptFiles(absolute));
      continue;
    }
    if (entry.endsWith('.ts')) {
      files.push(absolute);
    }
  }
  return files;
}

describe('cloud model exit baseline', () => {
  it('does not add new direct cloud model URL callers outside the migration baseline', () => {
    const actual = collectTypeScriptFiles(serverRoot)
      .filter(file => DIRECT_CLOUD_MODEL_URL.test(readFileSync(file, 'utf8')))
      .map(file => path.relative(repoRoot, file).replace(/\\/g, '/'))
      .sort();

    expect(actual).toEqual(BASELINE_FILES);
  });
});
