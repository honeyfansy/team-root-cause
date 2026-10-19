import type { RCACardType } from './card.js';

export type EdgeType = 'supports' | 'opposes' | 'relates_to' | 'leads_to' | 'alternative_to';

export interface Edge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  phase: string;
  flowId: string;
}

export type CanvasChangeType =
  | 'card_added'
  | 'card_removed'
  | 'card_updated'
  | 'card_moved'
  | 'edge_added'
  | 'edge_removed'
  | 'phase_changed'
  | 'batch';

export interface CanvasChange {
  type: CanvasChangeType;
  card?: import('./card.js').RCACard;
  cardId?: string;
  edge?: Edge;
  edges?: Edge[];
  cards?: import('./card.js').RCACard[];
  cardType?: RCACardType;
  phase?: string;
  changes?: CanvasChange[];
  timestamp: number;
}

export interface CanvasState {
  sessionId: string;
  cards: import('./card.js').RCACard[];
  edges: Edge[];
  phase: string;
}
