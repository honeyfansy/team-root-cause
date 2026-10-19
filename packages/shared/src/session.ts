import type { RCAAgentConfig } from './agent.js';
import type { RCACard } from './card.js';
import type { Edge } from './canvas.js';
import type { RCAMethod } from './agent.js';

export type RCAPhase =
  | 'problem_framing'
  | 'timeline_evidence'
  | 'multi_angle_analysis'
  | 'root_cause_convergence'
  | 'remediation_planning'
  | 'complete';

export type SessionStatus = 'idle' | 'running' | 'paused' | 'waiting_input' | 'complete' | 'error';

export type InterventionMode = 'automatic' | 'smart_pause' | 'manual';

export interface FlowConfig {
  id: string;
  name: string;
  description: string;
  phase: RCAPhase;
  phaseHistory: RCAPhase[];
  status: 'pending' | 'running' | 'complete';
}

export interface SessionConfig {
  topic: string;
  subTopics: string[];
  flows: FlowConfig[];
  agents: RCAAgentConfig[];
  interventionMode: InterventionMode;
  rcaMethods: RCAMethod[];
  autoConfirmPhase: boolean;
  canvasChangeResponse: 'continue' | 'stop';
  llmProvider?: string;
  llmBaseURL?: string;
  llmApiKey?: string;
}

export interface Session {
  id: string;
  name: string;
  config: SessionConfig;
  status: SessionStatus;
  currentFlowIndex: number;
  phase: RCAPhase;
  phaseHistory: RCAPhase[];
  canvas: {
    cards: RCACard[];
    edges: Edge[];
  };
  createdAt: number;
  updatedAt: number;
  pendingDecisions: number;
  unresolvedCount: number;
}
