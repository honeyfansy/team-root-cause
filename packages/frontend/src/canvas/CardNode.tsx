import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { CARD_COLORS, type RCACardType } from '@team-root-cause/shared';

interface RCACardData {
  label: string;
  cardType: RCACardType;
  author: string;
  phase: string;
  status: string;
  evidenceType?: string;
  analysisMethod?: string;
  confidenceLevel?: string;
  evidenceTrace?: string[];
  tags: string[];
}

export function CardNode({ data }: NodeProps<RCACardData>) {
  const colors = CARD_COLORS[data.cardType] || CARD_COLORS.note;
  const showMeta = data.evidenceType || data.analysisMethod || data.confidenceLevel;

  return (
    <div
      style={{
        ...styles.node,
        background: colors.bg,
        borderColor: colors.border,
      }}
    >
      <div style={{ ...styles.typeLabel, background: colors.border }}>
        {colors.label}
      </div>
      <div style={styles.content}>{data.label}</div>
      {showMeta && (
        <div style={styles.meta}>
          {data.evidenceType && (
            <span style={{
              ...styles.metaTag,
              background: data.evidenceType === 'fact' ? '#E8F5E9' : '#FFF3E0',
              color: data.evidenceType === 'fact' ? '#2E7D32' : '#E65100',
            }}>
              {data.evidenceType === 'fact' ? '事实' : '假设'}
            </span>
          )}
          {data.analysisMethod && (
            <span style={styles.metaTag}>{data.analysisMethod}</span>
          )}
          {data.confidenceLevel && (
            <span style={{
              ...styles.metaTag,
              background: data.confidenceLevel === 'high' ? '#E8F5E9' : data.confidenceLevel === 'medium' ? '#FFF3E0' : '#FFEBEE',
              color: data.confidenceLevel === 'high' ? '#2E7D32' : data.confidenceLevel === 'medium' ? '#E65100' : '#C62828',
            }}>
              {data.confidenceLevel === 'high' ? '高置信' : data.confidenceLevel === 'medium' ? '中置信' : '低置信'}
            </span>
          )}
        </div>
      )}
      <div style={styles.footer}>
        <span style={styles.author}>@{data.author}</span>
        {data.tags && data.tags.length > 0 && (
          <span style={styles.tags}>
            {data.tags.map((t, i) => (
              <span key={i} style={styles.tag}>#{t}</span>
            ))}
          </span>
        )}
      </div>
      <Handle type="target" position={Position.Left} style={styles.handle} />
      <Handle type="source" position={Position.Right} style={styles.handle} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  node: {
    width: 180, minHeight: 64,
    borderRadius: 8, border: '2px solid',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    cursor: 'pointer', transition: 'box-shadow 0.2s',
  },
  typeLabel: {
    fontSize: 10, fontWeight: 600, color: 'white',
    padding: '2px 8px', textTransform: 'uppercase',
    letterSpacing: 0.5, borderRadius: '6px 6px 0 0',
  },
  content: {
    padding: '8px 10px', fontSize: 13, fontWeight: 500,
    color: '#333', lineHeight: 1.4, flex: 1,
    wordBreak: 'break-word',
  },
  meta: {
    padding: '2px 8px', display: 'flex', gap: 4, flexWrap: 'wrap',
  },
  metaTag: {
    fontSize: 9, padding: '1px 6px', borderRadius: 8,
    background: '#f0f0f0', color: '#666', fontWeight: 600,
  },
  footer: {
    padding: '2px 8px 4px', fontSize: 10, color: '#999',
    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
  },
  author: { fontStyle: 'italic' },
  tags: { display: 'flex', gap: 2, flexWrap: 'wrap' },
  tag: { color: '#667eea', fontSize: 9 },
  handle: {
    width: 8, height: 8, background: '#999',
    border: '2px solid white', borderRadius: '50%',
  },
};
