import { AgentRegistry } from '../agents/AgentRegistry.js';
import { CanvasManager } from '../canvas/CanvasManager.js';
import { WebSocketManager } from '../ws/WebSocketManager.js';
import { PHASE_CONFIGS, AGENT_SYSTEM_PROMPTS } from './phases.js';
import {
  RCA_METHOD_LABELS, type RCAMethod,
} from '@team-root-cause/shared';
import type {
  AgentMessage, CanvasAction, DecisionRequest, RCAPhase,
  RCACard, FlowConfig, AgentStatusInfo,
} from '@team-root-cause/shared';
import { randomUUID } from 'crypto';

interface PendingDecision extends DecisionRequest {
  resolve: (response: string) => void;
}

export class Orchestrator {
  private running = false;
  private paused = false;
  private waitingForInput = false;
  private abortController = new AbortController();
  private inputResolver: ((input: string) => void) | null = null;
  private flows: FlowConfig[] = [];
  private currentFlowIndex = 0;
  private llmProvider = '';
  private llmBaseURL = '';
  private llmApiKey = '';
  private rcaMethods: RCAMethod[] = ['five_whys'];
  private flowPhaseIndexes: Map<string, number> = new Map();
  private flowHistories: Map<string, string[]> = new Map();
  private roundsWithoutChange = 0;
  private pendingDecision: PendingDecision | null = null;

  private readonly phases: RCAPhase[] = [
    'problem_framing', 'timeline_evidence', 'multi_angle_analysis', 'root_cause_convergence', 'remediation_planning',
  ];

  private get currentFlowId(): string { return this.flows[this.currentFlowIndex]?.id || ''; }
  private get currentFlowTopic(): string { return this.flows[this.currentFlowIndex]?.description || ''; }
  private get flowPhaseIndex(): number {
    return this.flowPhaseIndexes.get(this.currentFlowId) || 0;
  }
  private set flowPhaseIndex(v: number) {
    this.flowPhaseIndexes.set(this.currentFlowId, v);
  }
  private get currentPhase(): RCAPhase {
    return this.phases[this.flowPhaseIndex] || 'problem_framing';
  }
  private get flowHistory(): string[] {
    const h = this.flowHistories.get(this.currentFlowId);
    if (!h) { const n: string[] = []; this.flowHistories.set(this.currentFlowId, n); return n; }
    return h;
  }
  private set flowHistory(v: string[]) { this.flowHistories.set(this.currentFlowId, v); }
  private get currentFlowName(): string { return this.flows[this.currentFlowIndex]?.name || ''; }

  constructor(
    private sessionId: string,
    private agents: AgentRegistry,
    private canvas: CanvasManager,
    private ws: WebSocketManager,
    flows: FlowConfig[],
    llmConfig: { provider?: string; baseURL?: string; apiKey?: string },
    rcaMethods?: RCAMethod[],
  ) {
    this.flows = flows;
    this.llmProvider = llmConfig.provider || '';
    this.llmBaseURL = llmConfig.baseURL || '';
    this.llmApiKey = llmConfig.apiKey || '';
    if (rcaMethods && rcaMethods.length > 0) this.rcaMethods = rcaMethods;

    this.canvas.onChange((change) => {
      this.ws.broadcast(this.sessionId, {
        type: 'canvas_update',
        payload: { change, state: this.canvas.getState() },
        timestamp: Date.now(),
      });
    });
  }

  getAgent(agentId: string) {
    return this.agents.get(agentId);
  }

  async start() {
    console.log(`[Orchestrator] Starting RCA session ${this.sessionId}`);
    this.running = true;
    this.ws.broadcast(this.sessionId, {
      type: 'session_state',
      payload: { status: 'running' },
      timestamp: Date.now(),
    });

    try {
      for (let fi = 0; fi < this.flows.length && this.running; fi++) {
        this.currentFlowIndex = fi;
        const flow = this.flows[fi];
        flow.status = 'running';
        this.ws.broadcast(this.sessionId, {
          type: 'session_state',
          payload: { status: 'running', flowName: flow.name, flowIndex: fi, flowTotal: this.flows.length },
          timestamp: Date.now(),
        });
        await this.runLoop();
        flow.status = 'complete';
        console.log(`[Orchestrator] Flow "${flow.name}" completed`);
      }

      this.running = false;
      console.log(`[Orchestrator] Session ${this.sessionId} completed`);
      this.ws.broadcast(this.sessionId, {
        type: 'session_state',
        payload: { status: 'complete', message: '根因分析完成！' },
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error('[Orchestrator] Error:', err);
      this.running = false;
      this.ws.broadcast(this.sessionId, {
        type: 'session_state',
        payload: { status: 'error', message: err.message },
        timestamp: Date.now(),
      });
    }
  }

  stop() {
    this.running = false;
    this.abortController.abort();
  }

  pause() { this.paused = true; }
  resume() {
    this.paused = false;
    if (this.inputResolver) { this.inputResolver('resume'); this.inputResolver = null; }
  }

  receiveUserInput(input: string, type: 'chat' | 'decision') {
    if (type === 'decision' && this.pendingDecision) {
      try {
        const parsed = JSON.parse(input);
        if (parsed.action === 'skip') {
          this.flowHistory.push('[决策已跳过]');
        } else {
          const chosen = parsed.optionId
            ? this.pendingDecision.options?.find((o: any) => o.id === parsed.optionId)?.label || parsed.optionId
            : parsed.customInput || input;
          this.flowHistory.push(`[决策]: ${chosen}`);
        }
      } catch {
        this.flowHistory.push(`[用户输入]: ${input}`);
      }
      this.pendingDecision.resolve(input);
      this.pendingDecision = null;
    } else {
      this.flowHistory.push(`[用户]: ${input}`);
    }
    this.waitingForInput = false;
    if (this.inputResolver) { this.inputResolver(input); this.inputResolver = null; }
    this.ws.broadcast(this.sessionId, {
      type: 'session_state',
      payload: { status: 'running' },
      timestamp: Date.now(),
    });
  }

  private async runLoop() {
    while (this.running) {
      if (this.paused) { await this.waitFor('resume'); continue; }
      if (this.waitingForInput) { const input = await this.waitFor('input'); this.receiveUserInput(input, 'chat'); continue; }

      const phase = this.currentPhase;
      const phaseConfig = PHASE_CONFIGS[phase as keyof typeof PHASE_CONFIGS];
      if (!phaseConfig) break;

      this.ws.broadcast(this.sessionId, {
        type: 'phase_change',
        payload: { phase, phaseLabel: phaseConfig.label },
        timestamp: Date.now(),
      });

      await this.runPhase(phase, phaseConfig);
      if (!this.running) break;

      this.flowHistory.push(`[System]: 阶段 "${phase}" 完成。推进到下一阶段。`);
      this.flowPhaseIndex++;
      this.roundsWithoutChange = 0;

      if (this.flowPhaseIndex >= this.phases.length) break;
    }
  }

  private async runPhase(phase: RCAPhase, config: typeof PHASE_CONFIGS.problem_framing) {
    console.log(`[Orchestrator] Starting phase: ${phase}`);
    const cardCountBefore = this.canvas.getCards().length;

    // Broadcast initial agent statuses
    for (const agent of this.agents.getAll()) {
      this.broadcastAgentStatus(agent.agentId, 'idle');
    }

    // Phase intro from facilitator
    const facilitator = this.agents.getFacilitator() || this.agents.getAll()[0];
    if (facilitator) {
      await this.facilitatorSay(config.introPrompt);
    }

    for (let round = 0; round < config.maxRounds; round++) {
      if (!this.running || this.paused) break;

      const action = await this.getFacilitatorAction(phase, round, config);
      if (!action) break;

      const handled = await this.executeFacilitatorAction(action, phase);
      if (!handled) break;

      // Check saturation
      const newCards = this.canvas.getCards().length - cardCountBefore;
      if (newCards === 0) this.roundsWithoutChange++;
      else this.roundsWithoutChange = 0;

      if (this.roundsWithoutChange >= config.saturationRounds) {
        await this.facilitatorSay(config.saturationMessage);
        break;
      }
    }

    // Phase summary — invite skeptic to provide perspective
    const summarizer = this.agents.getBySubRole('skeptic')[0] || facilitator;
    if (summarizer && summarizer.agentId !== facilitator?.agentId) {
      await this.inviteAgent(summarizer.agentId, `阶段 "${config.label}" 即将结束，请给出简要总结：发现了什么？关键分析是什么？还有什么未解决的问题？`);
    }
  }

  private async getFacilitatorAction(phase: string, round: number, config: any): Promise<CanvasAction | null> {
    const facilitator = this.agents.getFacilitator();
    if (!facilitator) {
      // No facilitator — invite first non-facilitator agent directly
      const agents = this.agents.getNonFacilitator();
      if (agents.length === 0) return null;
      const agent = agents[round % agents.length];
      const q = round === 0 ? '请分享你的初始分析' : '请继续提出补充分析';
      await this.inviteAgent(agent.agentId, q);
      return { type: 'summarize', payload: {} };
    }

    const instruction = config.facilitatorInstruction
      .replace('{round}', String(round + 1))
      .replace('{maxRounds}', String(config.maxRounds))
      .replace('{saturationRounds}', String(config.saturationRounds))
      .replace('{rcaStrategy}', this.buildRCAStrategy());

    console.log(`[Orchestrator] Facilitator round ${round + 1}/${config.maxRounds}`);
    this.broadcastAgentStatus(facilitator.agentId, 'thinking');

    const resp = await facilitator.call({
      instruction,
      context: this.buildContext(phase, facilitator.agentId),
      signal: this.abortController.signal,
      provider: this.llmProvider, baseURL: this.llmBaseURL, apiKey: this.llmApiKey,
    });

    if (resp.timedOut) {
      this.broadcastAgentStatus(facilitator.agentId, 'error', '超时', resp.inputTokens, resp.outputTokens);
      return null;
    }

    this.broadcastAgentStatus(facilitator.agentId, 'speaking', undefined, resp.inputTokens, resp.outputTokens);
    this.broadcastMessage(facilitator.agentId, resp.content, 'thought', resp.inputTokens, resp.outputTokens);
    this.flowHistory.push(`[引导者]: ${resp.content.slice(0, 200)}`);

    // Execute actions inline (add cards, edges)
    for (const action of resp.actions) {
      if (action.type === 'add_card') {
        this.canvas.addCard({
          type: (action.payload as any).type || 'note',
          content: (action.payload as any).content || '',
          position: { x: 100 + this.canvas.getCards().length * 20, y: 200 },
          author: facilitator.agentId,
          status: 'active',
          phase,
          flowId: this.currentFlowId,
          round,
          tags: [],
        });
        this.broadcastMessage(facilitator.agentId, `🖊️ 添加卡片: "${(action.payload as any).content}"`, 'action');
      }
    }

    // Find advance_phase or invite action
    const advanceAction = resp.actions.find((a) => a.type === 'advance_phase');
    if (advanceAction) return null;

    const inviteAction = resp.actions.find((a) => a.type === 'invite_agent' || a.type === 'invite_all');
    return inviteAction || { type: 'summarize', payload: {} };
  }

  private async executeFacilitatorAction(action: CanvasAction, phase: RCAPhase): Promise<boolean> {
    switch (action.type) {
      case 'invite_agent': {
        const p = action.payload as { target?: string; question?: string } | null;
        const target = p?.target || this.agents.getNonFacilitator()[0]?.agentId || '';
        const question = p?.question || '请从你的视角分享分析';
        if (target) await this.inviteAgent(target, question);
        return true;
      }

      case 'invite_all': {
        const payload = action.payload as { question?: string } | null;
        const question = payload?.question || '请从你的视角补充分析或提出意见';
        for (const agent of this.agents.getNonFacilitator()) {
          await this.inviteAgent(agent.agentId, question);
        }
        return true;
      }

      case 'add_card': {
        const cardPayload = action.payload as Partial<RCACard>;
        this.canvas.addCard({
          type: cardPayload.type || 'note',
          content: cardPayload.content || '',
          position: cardPayload.position || { x: 100 + this.canvas.getCards().length * 20, y: 200 },
          author: 'facilitator',
          status: 'active',
          phase,
          flowId: this.currentFlowId,
          round: 0,
          tags: [],
        });
        return true;
      }

      case 'add_cards': {
        const cards = (action.payload as { cards: Array<Partial<RCACard>> }).cards;
        if (cards) {
          for (const c of cards) {
            this.canvas.addCard({
              type: c.type || 'note',
              content: c.content || '',
              position: c.position || { x: 100 + Math.random() * 400, y: 200 + Math.random() * 200 },
              author: 'facilitator',
              status: 'active',
              phase,
              flowId: this.currentFlowId,
              round: 0,
              tags: [],
            });
          }
        }
        return true;
      }

      case 'add_edge': {
        const e = action.payload as { source: string; target: string; type: any };
        if (e.source && e.target) {
          this.canvas.addEdge({
            source: e.source,
            target: e.target,
            type: e.type || 'relates_to',
            phase,
            flowId: this.currentFlowId,
          });
        }
        return true;
      }

      case 'request_decision': {
        const decPayload = (action.payload || {}) as any;
        await this.requestUserDecision(
          decPayload.title || '需要决策',
          decPayload.description || '',
          decPayload.options || [],
        );
        return true;
      }

      case 'wait_for_user':
        await this.waitForUserInput(action.payload as any);
        return true;

      case 'summarize':
        return true;

      default:
        return true;
    }
  }

  private async inviteAgent(agentId: string, question: string) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.warn(`Agent "${agentId}" not found`);
      return;
    }

    this.broadcastMessage(agentId, question, 'question');
    console.log(`[Orchestrator] Calling agent "${agent.label}"`);
    this.broadcastAgentStatus(agentId, 'thinking');

    const resp = await agent.call({
      instruction: question,
      context: this.buildContext(this.currentPhase, agentId),
      signal: this.abortController.signal,
      provider: this.llmProvider, baseURL: this.llmBaseURL, apiKey: this.llmApiKey,
    });

    if (resp.timedOut) {
      console.log(`[Orchestrator] Agent "${agent.label}" timed out`);
      this.broadcastAgentStatus(agentId, 'error', '超时', resp.inputTokens, resp.outputTokens);
      this.broadcastMessage(agentId, `⚠️ ${agent.label} 响应超时，跳过本轮。`, 'action');
      this.flowHistory.push(`[${agent.label} timed out]`);
      return;
    }

    this.broadcastAgentStatus(agentId, 'speaking', undefined, resp.inputTokens, resp.outputTokens);
    console.log(`[Orchestrator] Agent "${agent.label}" responded`);

    if (resp.decisionRequest) {
      // Notify user of decision request
    }

    // Broadcast agent's message
    this.broadcastMessage(agentId, resp.content, 'thought', resp.inputTokens, resp.outputTokens);
    this.flowHistory.push(`[${agent.label}]: ${resp.content.slice(0, 200)}`);

    // Execute agent's actions
    if (resp.actions.length > 0) {
      for (const action of resp.actions) {
        this.executeAgentAction(action, agentId, this.currentPhase);
      }
      // Batch canvas update
      this.ws.broadcast(this.sessionId, {
        type: 'canvas_update',
        payload: { change: { type: 'batch', timestamp: Date.now() }, state: this.canvas.getState() },
        timestamp: Date.now(),
      });
    }
  }

  private executeAgentAction(action: CanvasAction, agentId: string, phase: string) {
    switch (action.type) {
      case 'propose_card': {
        const p = action.payload as { type?: string; content?: string; tags?: string[]; evidenceType?: string; analysisMethod?: string; evidenceTrace?: string[] };
        const card = this.canvas.addCard({
          type: (p.type || 'note') as any,
          content: p.content || '',
          position: { x: 100 + Math.random() * 400, y: 200 + this.canvas.getCards().length * 30 },
          author: agentId,
          status: 'active',
          phase,
          flowId: this.currentFlowId,
          round: 0,
          tags: p.tags || [],
          evidenceType: p.evidenceType as any,
          analysisMethod: p.analysisMethod as any,
          evidenceTrace: p.evidenceTrace,
        });
        this.broadcastMessage(agentId, `💡 提出: "${p.content}"`, 'action');
        break;
      }
      case 'propose_edges': {
        const edges = (action.payload as { edges?: Array<{ source: string; target: string; type: string }> })?.edges || [];
        for (const e of edges) {
          if (e.source && e.target) {
            this.canvas.addEdge({
              source: e.source,
              target: e.target,
              type: (e.type || 'relates_to') as any,
              phase,
              flowId: this.currentFlowId,
            });
          }
        }
        break;
      }
      case 'agree':
        this.broadcastMessage(agentId, `✅ 同意`, 'action');
        break;
      case 'disagree': {
        const da = action.payload as { reason?: string } | null;
        this.broadcastMessage(agentId, `❌ 异议: ${da?.reason || ''}`, 'action');
        this.flowHistory.push(`[${agentId} DISAGREES]: ${da?.reason || ''}`);
        break;
      }
    }
  }

  private async facilitatorSay(content: string) {
    const facilitator = this.agents.getFacilitator();
    const agentId = facilitator?.agentId || 'facilitator';
    this.broadcastMessage(agentId, content, 'thought');
    this.flowHistory.push(`[引导者]: ${content}`);
  }

  private broadcastAgentStatus(agentId: string, status: AgentStatusInfo['status'], message?: string, inputTokens?: number, outputTokens?: number) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    this.ws.broadcast(this.sessionId, {
      type: 'agent_status',
      payload: {
        status: {
          agentId,
          level: agent.config.level,
          subRole: agent.config.subRole,
          perspective: agent.config.perspective,
          label: agent.label,
          color: agent.config.color,
          model: agent.config.model,
          status,
          message,
          inputTokens,
          outputTokens,
        } satisfies AgentStatusInfo,
      },
      timestamp: Date.now(),
    });
  }

  private broadcastMessage(from: string, content: string, type: AgentMessage['type'], inputTokens?: number, outputTokens?: number) {
    this.ws.broadcast(this.sessionId, {
      type: 'agent_message',
      payload: {
        message: {
          id: randomUUID(),
          sessionId: this.sessionId,
          from,
          to: 'all',
          content,
          phase: this.currentPhase,
          timestamp: Date.now(),
          type,
          inputTokens,
          outputTokens,
        } satisfies AgentMessage,
      },
      timestamp: Date.now(),
    });
  }

  private async requestUserDecision(title: string, description: string, options: { id: string; label: string; description?: string }[]) {
    const decision: DecisionRequest = {
      id: randomUUID(),
      sessionId: this.sessionId,
      phase: this.currentPhase,
      title,
      description,
      context: this.flowHistory.slice(-5),
      options: options.map((o) => ({ id: o.id, label: o.label, description: o.description || '' })),
      from: ['facilitator'],
      status: 'pending',
      createdAt: Date.now(),
    };

    this.pendingDecision = { ...decision, resolve: () => {} };
    this.waitingForInput = true;

    this.ws.broadcast(this.sessionId, {
      type: 'decision_request',
      payload: { decision },
      timestamp: Date.now(),
    });
    this.ws.broadcast(this.sessionId, {
      type: 'session_state',
      payload: { status: 'waiting_input' },
      timestamp: Date.now(),
    });

    const input = await this.waitFor('input');
    this.waitingForInput = false;
    this.pendingDecision = null;
    this.ws.broadcast(this.sessionId, {
      type: 'session_state',
      payload: { status: 'running' },
      timestamp: Date.now(),
    });
  }

  private async waitForUserInput(payload: any) {
    this.waitingForInput = true;
    const prompt = (payload as any)?.prompt || '';
    this.broadcastMessage('facilitator', `⏸️ 暂停 — 需要你的输入: ${prompt}`, 'action');
    this.ws.broadcast(this.sessionId, {
      type: 'session_state',
      payload: { status: 'waiting_input' },
      timestamp: Date.now(),
    });
    const input = await this.waitFor('input');
    this.flowHistory.push(`[用户输入]: ${input}`);
    this.waitingForInput = false;
    this.ws.broadcast(this.sessionId, {
      type: 'session_state',
      payload: { status: 'running' },
      timestamp: Date.now(),
    });
  }

  private buildContext(phase: string, agentId: string) {
    const history = this.flowHistory;
    const recentHistory = history.length > 12
      ? history.slice(-12)
      : history;
    return {
      phase,
      topic: this.currentFlowTopic,
      cardSummary: this.canvas.getStateSummary(this.currentFlowId),
      conversationHistory: recentHistory,
      canvasState: this.canvas.getStateSummary(this.currentFlowId),
    };
  }

  /** Build the RCA method strategy text for the multi_angle_analysis phase */
  private buildRCAStrategy(): string {
    const methods = this.rcaMethods;
    if (methods.length === 1) {
      // Single method — show that method's strategy
      return this.getSingleMethodStrategy(methods[0]);
    }

    // Multiple methods — build sequenced mixed strategy
    const methodNames = methods.map((m) => RCA_METHOD_LABELS[m]?.cn || m);
    const parts: string[] = [
      `选定的方法：${methodNames.join('、')}。`,
      '',
      '【混合模式 — 分阶段有序推进】',
    ];

    // Sort methods into a logical order: fishbone → five_whys → fta
    const orderedMethods = ['fishbone', 'five_whys', 'fta'].filter((m) =>
      methods.includes(m as RCAMethod)
    ) as RCAMethod[];

    let roundStart = 1;
    for (const method of orderedMethods) {
      const strategy = this.getSingleMethodStrategy(method, roundStart);
      parts.push(`\n${strategy}`);
      const roundCount = method === 'fishbone' ? 5 : method === 'five_whys' ? 6 : 5;
      roundStart += roundCount;
    }

    parts.push('\n请注意：严格按以上方法顺序分阶段推进，不要跳跃或混合执行。每个阶段结束后再进入下一个方法。');
    return parts.join('\n');
  }

  private getSingleMethodStrategy(method: RCAMethod, offset: number = 1): string {
    const round = (n: number) => `${offset + n - 1}`;
    switch (method) {
      case 'five_whys':
        return [
          `【5 Whys 模式】`,
          `- 第${round(1)}-${round(4)}轮：从表象症状开始第一层追问"为什么"`,
          `- 第${round(5)}-${round(8)}轮：深入第二/三层`,
          `- 第${round(9)}-${round(12)}轮：到达根因层`,
          `- 第${round(13)}轮+：全面检查，是否有遗漏的分支`,
        ].join('\n');
      case 'fishbone':
        return [
          `【鱼骨图模式】`,
          `- 第${round(1)}-${round(2)}轮：从6M（人/机/料/法/环/测）维度系统排查`,
          `- 第${round(3)}-${round(4)}轮：每个维度深入一层`,
          `- 第${round(5)}轮+：收拢到最可能的2-3类原因`,
        ].join('\n');
      case 'fta':
        return [
          `【FTA模式】`,
          `- 第${round(1)}-${round(2)}轮：定义顶层故障事件，构建第一层中间事件`,
          `- 第${round(3)}-${round(4)}轮：逐步分解中间事件到底层基本事件`,
          `- 第${round(5)}轮+：计算最小割集，识别关键路径`,
        ].join('\n');
      default:
        return '';
    }
  }

  private waitFor(reason: 'input' | 'resume'): Promise<string> {
    return new Promise((resolve) => {
      this.inputResolver = resolve;
    });
  }
}
