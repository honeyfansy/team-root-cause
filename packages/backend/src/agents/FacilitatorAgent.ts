import { BaseAgent, type AgentResponse, type AgentCallOptions } from './BaseAgent.js';

export class FacilitatorAgent extends BaseAgent {
  async call(options: AgentCallOptions): Promise<AgentResponse> {
    const { parsed, rawResult } = await this.callAIAndParse(options.instruction, options.context, options.signal, { provider: options.provider, baseURL: options.baseURL, apiKey: options.apiKey });

    if (rawResult.timedOut) {
      return { agentId: this.agentId, content: '', actions: [], timedOut: true };
    }

    try {
      const data = parsed || JSON.parse(rawResult.text);
      const { content, actions } = this.normalizeResponse(data, rawResult.text);
      return {
        agentId: this.agentId,
        content,
        actions,
        decisionRequest: data.decisionRequest,
        inputTokens: rawResult.inputTokens,
        outputTokens: rawResult.outputTokens,
      };
    } catch {
      return {
        agentId: this.agentId,
        content: rawResult.text,
        actions: [],
        inputTokens: rawResult.inputTokens,
        outputTokens: rawResult.outputTokens,
      };
    }
  }
}
