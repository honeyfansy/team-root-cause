export type RCACardType =
  | 'problem_statement'
  | 'timeline_event'
  | 'evidence'
  | 'candidate_root_cause'
  | 'analysis_chain'
  | 'root_cause_confirmation'
  | 'action_card'
  | 'question'
  | 'note';

export type CardStatus = 'active' | 'draft' | 'archived' | 'selected';

export type EvidenceType = 'fact' | 'hypothesis';

export type ActionType = 'short_term' | 'long_term';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type CardSeverity = 'S0' | 'S1' | 'S2' | 'S3';

export interface RCACard {
  id: string;
  type: RCACardType;
  content: string;
  position: { x: number; y: number };
  author: string;
  status: CardStatus;
  phase: string;
  round: number;
  flowId: string;
  parentId?: string;
  tags: string[];
  /** Evidence trace: links to evidence card IDs */
  evidenceTrace?: string[];
  /** Fact vs hypothesis */
  evidenceType?: EvidenceType;
  /** For action cards */
  actionType?: ActionType;
  /** Confidence level for root cause */
  confidenceLevel?: ConfidenceLevel;
  /** Severity for problem statements */
  severity?: CardSeverity;
  /** Analysis method used (for analysis_chain / candidate_root_cause) */
  analysisMethod?: 'five_whys' | 'fishbone' | 'fta';
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, string>;
}

export const CARD_COLORS: Record<RCACardType, { bg: string; border: string; label: string }> = {
  problem_statement:     { bg: '#FFEBEE', border: '#F44336', label: 'Problem' },
  timeline_event:        { bg: '#E3F2FD', border: '#2196F3', label: 'Timeline' },
  evidence:              { bg: '#E8F5E9', border: '#4CAF50', label: 'Evidence' },
  candidate_root_cause:  { bg: '#FFF3E0', border: '#FF9800', label: 'Candidate Cause' },
  analysis_chain:        { bg: '#F3E5F5', border: '#9C27B0', label: 'Analysis Chain' },
  root_cause_confirmation: { bg: '#FCE4EC', border: '#E91E63', label: 'Root Cause' },
  action_card:           { bg: '#E0F7FA', border: '#00BCD4', label: 'Action' },
  question:              { bg: '#FFF8E1', border: '#FFC107', label: 'Question' },
  note:                  { bg: '#ECEFF1', border: '#607D8B', label: 'Note' },
};
