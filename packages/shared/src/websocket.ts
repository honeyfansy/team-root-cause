import type { CanvasChange } from './canvas.js';
import type { AgentMessage, DecisionRequest } from './agent.js';
import type { Session, RCAPhase, SessionStatus } from './session.js';

export type WSMessageType =
  | 'session_state'
  | 'phase_change'
  | 'agent_message'
  | 'agent_thought'
  | 'agent_status'
  | 'canvas_update'
  | 'decision_request'
  | 'decision_response'
  | 'user_input'
  | 'user_input_chat'
  | 'session_control'
  | 'create_session'
  | 'session_created'
  | 'error'
  | 'canvas_change_question'
  | 'canvas_change_response'
  | 'update_agent_model'
  | 'reconnect_session';

export interface ServerMessage {
  type: WSMessageType;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface ClientMessage {
  type: WSMessageType;
  payload: Record<string, unknown>;
  timestamp: number;
}
