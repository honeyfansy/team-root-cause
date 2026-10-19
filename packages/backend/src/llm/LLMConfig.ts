import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export type LLMProvider = 'openai-compatible' | 'anthropic' | 'openai';

export interface LLMConfig {
  provider: LLMProvider;
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  modelMap: Record<string, string>;
  modelList?: string[];
}

async function fetchModelsFromAPI(provider: LLMProvider, baseURL: string, apiKey: string): Promise<string[]> {
  try {
    const url = provider === 'anthropic'
      ? `${baseURL.replace(/\/+$/, '')}/v1/models`
      : `${baseURL.replace(/\/+$/, '')}/models`;
    const res = await fetch(url, {
      headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const models: string[] = [];
      if (data.data && Array.isArray(data.data)) {
        for (const m of data.data) models.push(m.id || m);
      }
      if (data.models && Array.isArray(data.models)) {
        for (const m of data.models) models.push(m.id || m);
      }
      if (models.length > 0) return models.sort();
    }
  } catch { /* ignore */ }
  return [];
}

function loadConfig(): LLMConfig {
  const configPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../llm.config.json');
  let fileConfig: Partial<LLMConfig> = {};
  if (existsSync(configPath)) {
    try { fileConfig = JSON.parse(readFileSync(configPath, 'utf-8')); } catch { /* ignore */ }
  }
  const provider = (process.env.LLM_PROVIDER || fileConfig.provider || 'openai-compatible') as LLMProvider;
  const baseURL = process.env.LLM_BASE_URL || fileConfig.baseURL || 'http://127.0.0.1:8787';
  const apiKey = process.env.LLM_API_KEY || fileConfig.apiKey || 'sk-no-key-required';
  return {
    provider,
    baseURL,
    apiKey,
    defaultModel: process.env.LLM_DEFAULT_MODEL || fileConfig.defaultModel || '',
    modelList: fileConfig.modelList,
    modelMap: fileConfig.modelMap || {},
  };
}

export async function fetchAvailableModels(): Promise<string[]> {
  const cfg = getLLMConfig();
  if (cfg.modelList && cfg.modelList.length > 0) return cfg.modelList;
  return fetchModelsFromAPI(cfg.provider, cfg.baseURL, cfg.apiKey);
}

let cached: LLMConfig | null = null;

export function getLLMConfig(): LLMConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

export function resetLLMConfig() {
  cached = null;
}
