import type { RCAAgentConfig, CanvasAction } from '@team-root-cause/shared';
import { callAIWithRetry } from '../llm/callAI.js';

export interface AgentResponse {
  agentId: string;
  content: string;
  actions: CanvasAction[];
  decisionRequest?: import('@team-root-cause/shared').DecisionRequest;
  timedOut?: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentCallOptions {
  instruction: string;
  context: {
    phase: string;
    topic: string;
    cardSummary: string;
    conversationHistory: string[];
    canvasState: string;
  };
  signal?: AbortSignal;
  provider?: string;
  baseURL?: string;
  apiKey?: string;
}

export abstract class BaseAgent {
  constructor(public readonly config: RCAAgentConfig) {}

  get agentId(): string { return this.config.id; }
  get label(): string { return this.config.label; }
  get model(): string { return this.config.model; }

  abstract call(options: AgentCallOptions): Promise<AgentResponse>;

  protected buildSystemPrompt(phase: string): string {
    return this.config.systemPrompt.replace('{phase}', phase).replace('{perspective}', this.config.perspective || '');
  }

  protected async callAIAndParse(
    instruction: string,
    context: AgentCallOptions['context'],
    signal?: AbortSignal,
    llmOverrides?: { provider?: string; baseURL?: string; apiKey?: string },
  ): Promise<{ text: string; parsed: any; rawResult: import('../llm/callAI.js').CallAIResult }> {
    const systemPrompt = this.buildSystemPrompt(context.phase);
    const prompt = [
      `## 当前阶段: ${context.phase}`,
      `## 事故/问题: ${context.topic}`,
      `## 当前画布:`,
      context.canvasState,
      '',
      context.conversationHistory.length > 0
        ? `## 讨论记录:\n${context.conversationHistory.join('\n')}`
        : '## 这是本轮开始。',
      '',
      `## 任务:`,
      instruction,
    ].join('\n');

    const historyLen = context.conversationHistory.length;
    const timeoutMs = Math.min(90_000 + historyLen * 5_000, 300_000);

    const rawResult = await callAIWithRetry({
      model: this.config.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
      signal,
      timeoutMs,
      provider: llmOverrides?.provider,
      baseURL: llmOverrides?.baseURL,
      apiKey: llmOverrides?.apiKey,
    });

    if (rawResult.timedOut) {
      return { text: '', parsed: null, rawResult };
    }

    let parsed: any = null;
    try { parsed = JSON.parse(rawResult.text); } catch { /* not JSON */ }

    return { text: rawResult.text, parsed, rawResult };
  }

  protected normalizeResponse(data: any, rawText: string): { content: string; actions: any[] } {
    const content = data.reasoning || data.content || data.response?.answer || data.response?.question || rawText;
    let actions = data.actions || [];

    // evidence[] → propose card actions
    if (!actions.length && data.evidence?.length) {
      actions = data.evidence.map((i: any) => ({
        type: 'propose_card',
        payload: { type: 'evidence', content: i.title || i.content || i, evidenceType: i.evidenceType || 'fact' },
      }));
    }
    // timeline_events[] → timeline_event cards
    if (!actions.length && data.timeline_events?.length) {
      actions = data.timeline_events.map((p: any) => ({
        type: 'propose_card',
        payload: { type: 'timeline_event', content: p.title || p.content || p },
      }));
    }
    // candidate_causes[] → candidate_root_cause cards
    if (!actions.length && data.candidate_causes?.length) {
      actions = data.candidate_causes.map((c: any) => ({
        type: 'propose_card',
        payload: { type: 'candidate_root_cause', content: c.title || c.content || c, analysisMethod: c.analysisMethod, evidenceTrace: c.evidenceTrace },
      }));
    }
    // questions[] → question cards
    if (!actions.length && data.questions?.length) {
      actions = data.questions.map((q: any) => ({
        type: 'propose_card',
        payload: { type: 'question', content: q.title || q.content || q },
      }));
    }

    return { content, actions };
  }
}
