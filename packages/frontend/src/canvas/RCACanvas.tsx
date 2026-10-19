import React, { useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  type Node, type Edge as FlowEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useSessionStore } from '../store/useSessionStore.js';
import { CardNode } from './CardNode.js';
import type { RCACardType } from '@team-root-cause/shared';

const nodeTypes = { rcaCard: CardNode };

const PHASE_INFO: Record<string, { label: string; en: string; desc: string }> = {
  problem_framing:         { label: '问题定义', en: 'Problem Framing', desc: '清晰定义问题和影响范围' },
  timeline_evidence:       { label: '时间线与证据', en: 'Timeline & Evidence', desc: '重建事件时间线，收集事实证据' },
  multi_angle_analysis:    { label: '多角度分析', en: 'Multi-Angle Analysis', desc: '从多维度并行分析根因' },
  root_cause_convergence:  { label: '根因收敛', en: 'Root Cause Convergence', desc: '交叉验证，确认根本原因' },
  remediation_planning:    { label: '改进计划', en: 'Remediation Planning', desc: '制定改进措施和优先级' },
  complete:                { label: '已完成', en: 'Complete', desc: '根因分析完成！' },
};

const PHASES = ['problem_framing', 'timeline_evidence', 'multi_angle_analysis', 'root_cause_convergence', 'remediation_planning'];

const CARD_WIDTH = 180;
const CARD_GAP_X = 24;
const CARD_STEP_X = CARD_WIDTH + CARD_GAP_X;
const TYPE_GAP_Y = 40;
const CARD_HEADER_H = 20;
const CARD_FOOTER_H = 22;
const LINE_HEIGHT = 18;
const CHARS_PER_LINE = 11;

const estimateCardHeight = (content: string): number => {
  const lines = Math.max(1, Math.ceil(String(content).length / CHARS_PER_LINE));
  return CARD_HEADER_H + CARD_FOOTER_H + lines * LINE_HEIGHT + 12;
};

const TYPE_COLORS: Record<string, string> = {
  problem_statement: '#F44336', timeline_event: '#2196F3', evidence: '#4CAF50',
  candidate_root_cause: '#FF9800', analysis_chain: '#9C27B0',
  root_cause_confirmation: '#E91E63', action_card: '#00BCD4',
  question: '#FFC107', note: '#607D8B',
};

export function RCACanvas() {
  const cards = useSessionStore((s) => s.cards);
  const edges = useSessionStore((s) => s.edges);
  const phase = useSessionStore((s) => s.phase);
  const status = useSessionStore((s) => s.status);
  const agentStatuses = useSessionStore((s) => s.agentStatuses);
  const [thinkingStart, setThinkingStart] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const thinkingIds = agentStatuses.filter((a) => a.status === 'thinking').map((a) => a.agentId);
    setThinkingStart((prev) => {
      const next = { ...prev };
      for (const id of thinkingIds) { if (!next[id]) next[id] = Date.now(); }
      for (const id of Object.keys(next)) { if (!thinkingIds.includes(id)) delete next[id]; }
      return next;
    });
  }, [agentStatuses]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getThinkingTime = (id: string): string => {
    const start = thinkingStart[id];
    if (!start) return '';
    const elapsed = Math.floor((now - start) / 1000);
    if (elapsed < 3) return '';
    if (elapsed < 60) return `${elapsed}秒`;
    return `${Math.floor(elapsed / 60)}分${elapsed % 60}秒`;
  };

  const { nodes, flowEdges } = useMemo(() => {
    const typeOrder: RCACardType[] = [
      'problem_statement', 'timeline_event', 'evidence',
      'candidate_root_cause', 'analysis_chain', 'root_cause_confirmation',
      'action_card', 'question', 'note',
    ];
    const groupedByType = new Map<string, typeof cards>();
    for (const card of cards) {
      const arr = groupedByType.get(card.type) || [];
      arr.push(card);
      groupedByType.set(card.type, arr);
    }

    const cardNodes: Node[] = [];
    let currentY = 60;
    for (const type of typeOrder) {
      const typeCards = groupedByType.get(type);
      if (!typeCards || typeCards.length === 0) continue;

      const maxCol = Math.max(1, Math.floor(2500 / CARD_STEP_X));
      const rowsForType = Math.ceil(typeCards.length / maxCol);

      let maxCardH = 0;
      typeCards.forEach(c => {
        const h = estimateCardHeight(c.content);
        if (h > maxCardH) maxCardH = h;
      });
      const typeRowHeight = maxCardH + TYPE_GAP_Y;

      typeCards.forEach((card, idx) => {
        const col = idx % maxCol;
        const row = Math.floor(idx / maxCol);
        const cardH = estimateCardHeight(card.content);

        cardNodes.push({
          id: card.id,
          type: 'rcaCard',
          position: {
            x: 40 + col * CARD_STEP_X,
            y: currentY + row * (cardH + 8),
          },
          data: {
            label: card.content,
            cardType: card.type,
            author: card.author,
            phase: card.phase,
            status: card.status,
            evidenceType: card.evidenceType,
            analysisMethod: card.analysisMethod,
            confidenceLevel: card.confidenceLevel,
            evidenceTrace: card.evidenceTrace,
            tags: card.tags || [],
          },
        });
      });

      currentY += typeRowHeight * rowsForType;
    }

    const nodes: Node[] = [...cardNodes];

    const flowEdges: FlowEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: true,
      label: edgeLabel(e.type),
      style: { stroke: '#999', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#999' },
      labelStyle: { fontSize: 10, fill: '#666' },
    }));

    return { nodes, flowEdges };
  }, [cards, edges]);

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative' }}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.phaseBadge}>
          <div style={styles.phaseLabel}>
            阶段 {PHASES.indexOf(phase) + 1}/{PHASES.length}: <strong>{PHASE_INFO[phase]?.label || phase}</strong>
          </div>
          <div style={styles.phaseEn}>{PHASE_INFO[phase]?.en || ''} — {PHASE_INFO[phase]?.desc || ''}</div>
        </div>
        {agentStatuses.filter((a) => a.status === 'thinking').map((a) => {
          const elapsed = getThinkingTime(a.agentId);
          const tooLong = (thinkingStart[a.agentId] && now - thinkingStart[a.agentId] > 60000);
          return (
            <span key={a.agentId} style={{
              ...styles.thinkingPill,
              ...(tooLong ? styles.thinkingPillSlow : {}),
            }}>
              ◌ {a.label} 分析中{elapsed ? ` (${elapsed})` : ''}
              {tooLong ? ' ⚠️' : ''}
            </span>
          );
        })}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        style={{ background: '#FAFBFC' }}
        nodesDraggable={true}
        nodesConnectable={false}
      >
        <Background color="#eee" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(n) => {
            const type = (n.data as any)?.cardType as string;
            return TYPE_COLORS[type] || '#ccc';
          }}
          style={{ border: '1px solid #ddd' }}
        />
      </ReactFlow>

      {/* Card legend */}
      <div style={styles.legend}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: color }} />
            <span style={styles.legendLabel}>{type}</span>
          </div>
        ))}
        <div style={styles.legendCount}>
          卡片: {cards.length} | 连线: {edges.length}
        </div>
      </div>
    </div>
  );
}

function edgeLabel(type: string): string {
  const labels: Record<string, string> = {
    supports: '支持', opposes: '反对', relates_to: '相关',
    leads_to: '导致', alternative_to: '替代',
  };
  return labels[type] || type;
}

const styles: Record<string, React.CSSProperties> = {
  topBar: {
    position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
    display: 'flex', alignItems: 'flex-start', gap: 12,
    pointerEvents: 'none',
  },
  phaseBadge: {
    background: 'rgba(255,255,255,0.95)', padding: '8px 16px',
    borderRadius: 12, fontSize: 13,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    pointerEvents: 'auto',
  },
  phaseLabel: { fontSize: 13, fontWeight: 500 },
  phaseEn: { fontSize: 11, color: '#888', marginTop: 2 },
  thinkingPill: {
    background: 'rgba(255,152,0,0.15)', color: '#E65100',
    padding: '4px 12px', borderRadius: 16, fontSize: 12,
    fontWeight: 500,
    animation: 'pulse 1.5s ease-in-out infinite',
    pointerEvents: 'auto',
  },
  thinkingPillSlow: {
    background: 'rgba(244,67,54,0.15)', color: '#C62828',
    animation: 'pulse 0.8s ease-in-out infinite',
  },
  legend: {
    position: 'absolute', bottom: 12, left: 12, zIndex: 10,
    background: 'rgba(255,255,255,0.9)', padding: '8px 12px',
    borderRadius: 8, display: 'flex', gap: 10, flexWrap: 'wrap',
    fontSize: 11, boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    pointerEvents: 'auto',
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: '50%' },
  legendLabel: { color: '#666' },
  legendCount: { color: '#999', fontFamily: 'monospace', marginLeft: 8, borderLeft: '1px solid #ddd', paddingLeft: 8 },
};
