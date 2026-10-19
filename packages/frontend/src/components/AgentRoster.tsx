import React, { useState } from 'react';
import { useSessionStore } from '../store/useSessionStore.js';
import { SUB_ROLE_LABELS, LEVEL_LABELS, type AgentStatusType, type SubRole } from '@team-root-cause/shared';

const STATUS_INDICATORS: Record<AgentStatusType, { icon: string; color: string }> = {
  idle:     { icon: '○', color: '#bbb' },
  thinking: { icon: '◌', color: '#FF9800' },
  speaking: { icon: '●', color: '#4CAF50' },
  waiting:  { icon: '◉', color: '#2196F3' },
  done:     { icon: '✓', color: '#4CAF50' },
  error:    { icon: '✕', color: '#f44336' },
};

const STATUS_LABELS: Record<AgentStatusType, string> = {
  idle: '空闲', thinking: '分析中...', speaking: '发言中',
  waiting: '等待中', done: '已完成', error: '出错',
};

export function AgentRoster() {
  const agentStatuses = useSessionStore((s) => s.agentStatuses);
  const session = useSessionStore((s) => s.session);
  const agentTokenAccum = useSessionStore((s) => s.agentTokenAccum);
  const availableModels = useSessionStore((s) => s.availableModels);
  const [expanded, setExpanded] = useState(false);

  const displayStatuses = agentStatuses.length > 0 ? agentStatuses
    : (session?.config?.agents || []).map((a) => ({
        agentId: a.id,
        level: a.level,
        subRole: a.subRole,
        perspective: a.perspective,
        label: a.label,
        color: a.color,
        model: a.model,
        status: 'idle' as AgentStatusType,
      }));

  const activeCount = displayStatuses.filter((a) => a.status !== 'idle').length;

  return (
    <div style={styles.wrapper}>
      <div style={styles.roster}>
        {displayStatuses.map((agent) => {
          const indicator = STATUS_INDICATORS[agent.status] || STATUS_INDICATORS.idle;
          const subRoleInfo = agent.subRole ? SUB_ROLE_LABELS[agent.subRole as SubRole] : null;
          const levelInfo = agent.level ? LEVEL_LABELS[agent.level as keyof typeof LEVEL_LABELS] : null;
          const perspectiveTag = agent.perspective ? ` (${agent.perspective})` : '';
          const prefix = levelInfo ? levelInfo.cn.slice(0, 2) : '';
          return (
            <div
              key={agent.agentId}
              style={{ ...styles.agent, borderLeftColor: agent.color }}
              onClick={() => setExpanded(!expanded)}
            >
              <span style={{ ...styles.dot, color: indicator.color }}>{indicator.icon}</span>
              <span style={styles.name}>{prefix}/{agent.label}{perspectiveTag}</span>
              <span style={{ ...styles.statusText, color: indicator.color }}>
                {STATUS_LABELS[agent.status] || '空闲'}
              </span>
            </div>
          );
        })}
        <span style={styles.agentCount}>
          {displayStatuses.length} Agent ({activeCount} 活跃)
        </span>
      </div>

      {expanded && (
        <div style={styles.detailPanel}>
          {displayStatuses.map((agent) => {
            const subRoleInfo = agent.subRole ? SUB_ROLE_LABELS[agent.subRole as SubRole] : null;
            const stats = agentTokenAccum[agent.agentId];
            return (
              <div key={agent.agentId} style={styles.detailRow}>
                <span style={{ ...styles.detailRole, color: agent.color }}>
                  {agent.label}
                  {agent.perspective && <span style={styles.detailEn}> ({agent.perspective})</span>}
                </span>
                <div style={styles.detailMeta}>
                  <span style={styles.detailDesc}>{subRoleInfo?.desc || ''}</span>
                  <span style={styles.detailModel}>
                    Model:
                    <select
                      value={agent.model}
                      onChange={(e) => {
                        const m = e.target.value;
                        useSessionStore.getState().changeAgentModel(
                          useSessionStore.getState().sessionId || '',
                          agent.agentId, m
                        );
                      }}
                      style={styles.modelSelect}
                    >
                      {(availableModels.length > 0 ? availableModels : [agent.model]).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </span>
                  {stats && (
                    <span style={styles.detailTokens}>
                      发言 {stats.speakCount} 次 · Tokens ⬆{stats.input} ⬇{stats.output}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div style={styles.detailHint}>角色配置在设置页修改，重新启动会话生效</div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { borderBottom: '1px solid #e0e0e0', background: '#fafafa' },
  roster: {
    display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center',
    padding: '6px 12px',
  },
  agent: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 12,
    background: 'white', fontSize: 11, cursor: 'pointer',
    borderLeft: '3px solid transparent',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  dot: { fontSize: 10, lineHeight: '12px' },
  name: { fontWeight: 600, fontSize: 11, color: '#333', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusText: { fontSize: 10, fontStyle: 'italic', marginLeft: 2 },
  agentCount: { fontSize: 10, color: '#999', marginLeft: 4, fontFamily: 'monospace' },
  detailPanel: { padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #eee' },
  detailRow: { display: 'flex', flexDirection: 'column', gap: 2 },
  detailRole: { fontWeight: 600, fontSize: 12 },
  detailEn: { fontWeight: 400, color: '#999', fontSize: 11 },
  detailMeta: { display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 8 },
  detailDesc: { fontSize: 11, color: '#888' },
  detailModel: { fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 6 },
  modelSelect: { fontSize: 11, padding: '1px 4px', borderRadius: 4, border: '1px solid #ddd', background: 'white', flex: 1 },
  detailTokens: { fontSize: 11, color: '#4CAF50', fontFamily: 'monospace' },
  detailHint: { fontSize: 10, color: '#bbb', textAlign: 'center', marginTop: 4 },
};
