import 'dotenv/config';
import { WebSocketManager } from './ws/WebSocketManager.js';
import { CanvasManager } from './canvas/CanvasManager.js';
import { Orchestrator } from './orchestrator/Orchestrator.js';
import { AgentRegistry } from './agents/AgentRegistry.js';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getLLMConfig, fetchAvailableModels, resetLLMConfig } from './llm/LLMConfig.js';
import { detectLocalAgents } from './llm/AgentDetector.js';
import type { Session, SessionConfig } from '@team-root-cause/shared';

const sessions = new Map<string, { session: Session; canvas: CanvasManager; orchestrator: Orchestrator }>();

const server = createServer((_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (_req.url === '/health' && _req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (_req.url === '/api/config' && _req.method === 'GET') {
    const cfg = getLLMConfig();
    fetchAvailableModels().then((models) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        availableModels: models,
        providers: ['anthropic', 'openai-compatible', 'openai'],
        currentProvider: cfg.provider,
        modelMap: cfg.modelMap,
      }));
    });
    return;
  }

  if (_req.url === '/api/detect-agents' && _req.method === 'GET') {
    detectLocalAgents().then((agents) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agents }));
    });
    return;
  }

  if (_req.url === '/api/config' && _req.method === 'POST') {
    let body = '';
    _req.on('data', (chunk) => body += chunk);
    _req.on('end', () => {
      try {
        const newConfig = JSON.parse(body);
        const configPath = resolve(dirname(fileURLToPath(import.meta.url)), '../llm.config.json');
        const existing = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf-8')) : {};
        const merged = { ...existing, ...newConfig };
        writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
        resetLLMConfig();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const wsm = new WebSocketManager(server);

wsm.on('create_session', async (ws, payload) => {
  const config = payload.config as SessionConfig;
  const id = randomUUID();
  wsm.subscribe(ws, id);

  const agentRegistry = new AgentRegistry(config);
  const canvas = new CanvasManager(id);
  const orchestrator = new Orchestrator(id, agentRegistry, canvas, wsm, config.flows, {
    provider: config.llmProvider, baseURL: config.llmBaseURL, apiKey: config.llmApiKey,
  }, config.rcaMethods);

  const session: Session = {
    id,
    name: config.topic?.slice(0, 50) || 'Root Cause Analysis',
    config,
    status: 'idle',
    currentFlowIndex: 0,
    phase: 'problem_framing',
    phaseHistory: [],
    canvas: { cards: [], edges: [] },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pendingDecisions: 0,
    unresolvedCount: 0,
  };

  sessions.set(id, { session, canvas, orchestrator });

  wsm.send(ws, {
    type: 'session_created',
    payload: { sessionId: id },
    timestamp: Date.now(),
  });

  session.status = 'running';
  orchestrator.start();
});

wsm.on('reconnect_session', (ws, payload) => {
  const sessionId = payload?.sessionId as string;
  if (!sessionId || !sessions.has(sessionId)) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Session not found' }, timestamp: Date.now() }));
    return;
  }
  wsm.subscribe(ws, sessionId);
  const { session, canvas } = sessions.get(sessionId)!;
  ws.send(JSON.stringify({
    type: 'session_state',
    payload: { status: session.status, phase: session.phase },
    timestamp: Date.now(),
  }));
  ws.send(JSON.stringify({
    type: 'canvas_update',
    payload: { state: { cards: canvas.getCards(), edges: canvas.getEdges() } },
    timestamp: Date.now(),
  }));
  ws.send(JSON.stringify({
    type: 'phase_change',
    payload: { phase: session.phase, phaseLabel: session.phase },
    timestamp: Date.now(),
  }));
  console.log(`[Server] Client reconnected to session ${sessionId}`);
});

wsm.on('session_control', async (ws, payload) => {
  const { sessionId, action } = payload as { sessionId: string; action: string };
  const entry = sessions.get(sessionId);
  if (!entry) return;

  switch (action) {
    case 'pause':
      entry.orchestrator.pause();
      entry.session.status = 'paused';
      break;
    case 'resume':
      entry.orchestrator.resume();
      entry.session.status = 'running';
      break;
    case 'stop':
      entry.session.status = 'complete';
      entry.orchestrator.stop();
      break;
  }
  wsm.broadcast(sessionId, {
    type: 'session_state',
    payload: { status: entry.session.status },
    timestamp: Date.now(),
  });
});

wsm.on('user_input', async (ws, payload) => {
  const { sessionId, content } = payload as { sessionId: string; content: string };
  const entry = sessions.get(sessionId);
  if (!entry) return;
  entry.orchestrator.receiveUserInput(content, 'chat');
});

wsm.on('update_agent_model', async (ws, payload) => {
  const { sessionId, agentId, model } = payload as { sessionId: string; agentId: string; model: string };
  const entry = sessions.get(sessionId);
  if (!entry) return;
  const agent = entry.orchestrator.getAgent(agentId);
  if (agent) {
    (agent.config as any).model = model;
    wsm.broadcast(sessionId, {
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
          status: 'idle',
        },
      },
      timestamp: Date.now(),
    });
  }
});

wsm.on('decision_response', async (ws, payload) => {
  const { sessionId, ...response } = payload as { sessionId: string; requestId: string; optionId?: string; customInput?: string; action: string };
  const entry = sessions.get(sessionId);
  if (!entry) return;
  entry.orchestrator.receiveUserInput(JSON.stringify(response), 'decision');
});

const PORT = parseInt(process.env.PORT || '3002', 10);
server.listen(PORT, () => {
  console.log(`Team Root Cause Analysis Server running on port ${PORT}`);
});
