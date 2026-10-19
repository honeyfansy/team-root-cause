import React, { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../store/useSessionStore.js';
import { AgentRoster } from '../components/AgentRoster.js';
import { SUB_ROLE_COLORS, type SubRole } from '@team-root-cause/shared';
import type { AgentMessage } from '@team-root-cause/shared';

const TYPE_ICONS: Record<string, string> = {
  thought: '💭',
  question: '❓',
  decision: '✅',
  action: '⚡',
  chat: '💬',
};

export function AgentPanel() {
  const messages = useSessionStore((s) => s.messages);
  const phase = useSessionStore((s) => s.phase);
  const status = useSessionStore((s) => s.status);
  const agentStatuses = useSessionStore((s) => s.agentStatuses);
  const sendInput = useSessionStore((s) => s.sendInput);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  const getAgentLabel = (agentId: string): string => {
    const agent = agentStatuses.find((a) => a.agentId === agentId);
    return agent?.label || agentId;
  };

  const getAgentColor = (agentId: string): string => {
    if (agentId === 'facilitator' || agentId === '引导者') return '#9E9E9E';
    const agent = agentStatuses.find((a) => a.agentId === agentId);
    return agent?.color || SUB_ROLE_COLORS[agent?.subRole as SubRole] || '#999';
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pendingDecision = useSessionStore((s) => s.pendingDecision);
  const sendDecision = useSessionStore((s) => s.sendDecision);

  const handleSend = () => {
    if (!input.trim()) return;
    if (pendingDecision) {
      sendDecision(pendingDecision.id, undefined, input.trim());
    } else {
      sendInput(input.trim());
    }
    setInput('');
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h3 style={styles.headerTitle}>分析面板</h3>
        <span style={{
          ...styles.statusDot,
          background: status === 'running' ? '#4CAF50' : status === 'waiting_input' ? '#FF9800' : '#999',
        }} />
        <span style={styles.statusText}>{status}</span>
      </div>
      <AgentRoster />

      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>等待 Agent 开始分析...</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={{
            ...styles.message,
            borderLeftColor: getAgentColor(msg.from),
            background: msg.type === 'chat' ? '#f0f4ff' : 'white',
          }}>
            <div style={styles.msgHeader}>
              <span style={styles.typeIcon}>{TYPE_ICONS[msg.type] || '💭'}</span>
              <span style={{ ...styles.roleLabel, color: getAgentColor(msg.from) }}>
                {getAgentLabel(msg.from)}
              </span>
              <span style={styles.msgTime}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div style={styles.msgContent}>{msg.content}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {status === 'waiting_input' ? (
        <div style={styles.inputArea}>
          <input
            style={styles.input}
            placeholder="输入你的回应或补充证据..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            autoFocus
          />
          <button onClick={handleSend} style={styles.sendBtn}>发送</button>
        </div>
      ) : status === 'running' ? (
        <div style={styles.runningBanner}>
          <span style={styles.runningDot} />
          Agent 正在自动分析中...
        </div>
      ) : (
        <div style={styles.runningBanner}>
          {status === 'paused' ? '⏸ 已暂停' : status === 'complete' ? '✅ 分析完成' : `状态: ${status}`}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 360,
    display: 'flex', flexDirection: 'column',
    borderLeft: '1px solid #e0e0e0',
    background: '#fafafa',
    flexShrink: 0,
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'white',
  },
  headerTitle: { fontSize: 15, fontWeight: 600, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: '50%' },
  statusText: { fontSize: 12, color: '#666' },
  messages: {
    flex: 1, overflowY: 'auto', padding: 12,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  empty: {
    color: '#999', fontSize: 13, textAlign: 'center',
    padding: 40, fontStyle: 'italic',
  },
  message: {
    padding: '8px 12px', borderRadius: 8,
    borderLeft: '3px solid',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  msgHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  typeIcon: { fontSize: 12 },
  roleLabel: { fontSize: 12, fontWeight: 600 },
  msgTime: { fontSize: 10, color: '#bbb' },
  msgContent: { fontSize: 13, color: '#444', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  inputArea: {
    padding: 10, borderTop: '1px solid #e0e0e0',
    display: 'flex', gap: 8, background: 'white',
  },
  input: {
    flex: 1, padding: '8px 12px', borderRadius: 8,
    border: '1px solid #ddd', fontSize: 13, outline: 'none',
  },
  sendBtn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#667eea', color: 'white', fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
  },
  runningBanner: {
    padding: '12px 16px', borderTop: '1px solid #e0e0e0',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: '#f5f5f5', fontSize: 13, color: '#666',
  },
  runningDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#4CAF50',
    animation: 'pulse 1.5s ease-in-out infinite',
    display: 'inline-block',
  },
};
