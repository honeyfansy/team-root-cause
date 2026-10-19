import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../store/useSessionStore.js';
import { fetchConfig, fetchDetectedAgents, type BackendConfig, type DetectedAgent } from '../store/api.js';
import {
  LEVEL_LABELS, SUB_ROLE_LABELS, SUB_ROLE_COLORS, SUB_ROLE_LEVEL,
  CORE_CONTRIBUTOR_ROLES, OPTIONAL_CONTRIBUTOR_ROLES, SUB_ROLE_PERSPECTIVE_PRESETS,
  RCA_METHOD_LABELS, type Level, type SubRole, type RCAMethod,
  type SessionConfig, type RCAAgentConfig,
} from '@team-root-cause/shared';

const SUB_ROLES_BY_LEVEL: Record<string, SubRole[]> = {
  contributor: [...CORE_CONTRIBUTOR_ROLES, ...OPTIONAL_CONTRIBUTOR_ROLES],
  management: ['tech_lead', 'feature_owner', 'project_manager', 'scrum_master', 'pm', 'engineering_manager', 'director', 'architect'],
  executive: ['cto', 'vp_engineering', 'board_rep'],
};

const RCA_METHODS: RCAMethod[] = ['five_whys', 'fishbone', 'fta'];

interface AgentInstance {
  id: string;
  level: Level;
  subRole: SubRole;
  perspective: string;
  label: string;
  color: string;
  model: string;
  temperature: number;
  enabled: boolean;
}

export function SessionSetup() {
  const createSession = useSessionStore((s) => s.createSession);
  const wsConnected = useSessionStore((s) => s.connected);

  const [topic, setTopic] = useState('');
  const [subTopicsText, setSubTopicsText] = useState('');
  const [mode, setMode] = useState<'smart_pause' | 'automatic' | 'manual'>('smart_pause');
  const [rcaMethods, setRcaMethods] = useState<RCAMethod[]>(['five_whys', 'fishbone']);
  const [backendConfig, setBackendConfig] = useState<BackendConfig | null>(null);
  const [detectedAgents, setDetectedAgents] = useState<DetectedAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [configError, setConfigError] = useState('');

  const [agentInstances, setAgentInstances] = useState<AgentInstance[]>(() => getDefaultInstances([]));

  function getDefaultInstances(models: string[]): AgentInstance[] {
    const defaultModel = models[0] || '';
    return [
      {
        id: 'facilitator-1',
        level: 'facilitator' as Level,
        subRole: 'tech_lead' as SubRole,
        perspective: '',
        label: '引导者',
        color: '#9E9E9E',
        model: defaultModel,
        temperature: 0.3,
        enabled: true,
      },
      // Contributor layer: core roles
      ...CORE_CONTRIBUTOR_ROLES.map((sr) => ({
        id: `contributor-${sr}`,
        level: 'contributor' as Level,
        subRole: sr,
        perspective: SUB_ROLE_PERSPECTIVE_PRESETS[sr],
        label: SUB_ROLE_LABELS[sr].cn,
        color: SUB_ROLE_COLORS[sr],
        model: defaultModel,
        temperature: 0.5,
        enabled: true,
      })),
      // Management layer: tech lead
      {
        id: 'management-tech_lead',
        level: 'management' as Level,
        subRole: 'tech_lead' as SubRole,
        perspective: SUB_ROLE_PERSPECTIVE_PRESETS.tech_lead,
        label: '技术负责人',
        color: SUB_ROLE_COLORS.tech_lead,
        model: defaultModel,
        temperature: 0.5,
        enabled: false,
      },
      // Executive layer: CTO
      {
        id: 'executive-cto',
        level: 'executive' as Level,
        subRole: 'cto' as SubRole,
        perspective: SUB_ROLE_PERSPECTIVE_PRESETS.cto,
        label: 'CTO',
        color: SUB_ROLE_COLORS.cto,
        model: defaultModel,
        temperature: 0.3,
        enabled: false,
      },
    ];
  }

  function getSelectedAgentModels(): string[] {
    if (selectedAgentId && detectedAgents.length > 0) {
      const agent = detectedAgents.find((a) => a.id === selectedAgentId);
      if (agent?.models?.length) return agent.models;
    }
    return backendConfig?.availableModels || [];
  }

  useEffect(() => {
    Promise.all([
      fetchConfig(),
      fetchDetectedAgents(),
    ]).then(([cfg, agentsList]) => {
      setBackendConfig(cfg);
      setDetectedAgents(agentsList);
      setConfigError('');

      const preferred = agentsList.find((a) => a.source === 'config')
        || agentsList.find((a) => a.id === 'claude-code')
        || agentsList.find((a) => a.id === 'openai')
        || agentsList[0];
      const agentId = preferred?.id || '';
      setSelectedAgentId(agentId);

      const models = preferred?.models?.length ? preferred.models : cfg.availableModels;
      if (models.length > 0) {
        setAgentInstances(getDefaultInstances(models));
      }
      setLoadingAgents(false);
    }).catch(() => {
      setConfigError('Cannot connect to backend — is it running on port 3002?');
      setLoadingAgents(false);
    });
  }, []);

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    const agent = detectedAgents.find((a) => a.id === agentId);
    const models = agent?.models?.length ? agent.models : (backendConfig?.availableModels || []);
    const defaultModel = models[0] || '';
    setAgentInstances((prev) => prev.map((a) => ({
      ...a,
      model: models.includes(a.model) ? a.model : defaultModel,
    })));
  };

  const updateInstance = (id: string, updates: Partial<AgentInstance>) => {
    setAgentInstances((prev) => prev.map((a) => a.id === id ? { ...a, ...updates } : a));
  };

  const removeInstance = (id: string) => {
    setAgentInstances((prev) => prev.filter((a) => a.id !== id));
  };

  const addInstance = (subRole: SubRole) => {
    const models = getSelectedAgentModels();
    const defaultModel = models[0] || '';
    const level = SUB_ROLE_LEVEL[subRole];
    const count = agentInstances.filter((a) => a.subRole === subRole).length;
    const suffix = count > 0 ? `-${count + 1}` : '';
    const newId = `${level}-${subRole}${suffix}`;
    setAgentInstances((prev) => [...prev, {
      id: newId,
      level: level as Level,
      subRole,
      perspective: SUB_ROLE_PERSPECTIVE_PRESETS[subRole] || '',
      label: SUB_ROLE_LABELS[subRole].cn,
      color: SUB_ROLE_COLORS[subRole],
      model: defaultModel,
      temperature: subRole === 'skeptic' ? 0.3 : subRole === 'cto' || subRole === 'board_rep' ? 0.3 : 0.5,
      enabled: true,
    }]);
  };

  const handleStart = () => {
    if (!topic.trim()) return;

    const flowConfigs = [{
      id: crypto.randomUUID(),
      name: topic.trim().slice(0, 40),
      description: topic.trim(),
      phase: 'problem_framing' as const,
      phaseHistory: [] as any[],
      status: 'pending' as const,
    }];

    const models = getSelectedAgentModels();
    const fallbackModel = models[0] || '';
    const selectedAgent = detectedAgents.find((a) => a.id === selectedAgentId);

    const finalInstances = agentInstances.filter((a) => a.enabled).map((a) => ({
      ...a,
      model: a.model || fallbackModel,
    }));

    const agentConfigs: RCAAgentConfig[] = finalInstances.map((a) => ({
      id: a.id,
      level: a.level,
      subRole: a.subRole,
      perspective: a.perspective,
      label: a.label,
      model: a.model,
      temperature: a.temperature,
      systemPrompt: '',
      color: a.color,
      enabled: true,
    }));

    const subTopics = subTopicsText.split('\n').map((s) => s.trim()).filter(Boolean);

    const config: SessionConfig = {
      topic: topic.trim(),
      subTopics,
      flows: flowConfigs,
      agents: agentConfigs,
      interventionMode: mode,
      rcaMethods,
      autoConfirmPhase: mode === 'automatic',
      canvasChangeResponse: 'continue',
      llmProvider: selectedAgent?.provider || backendConfig?.currentProvider || 'anthropic',
      llmBaseURL: selectedAgent?.baseURL || '',
      llmApiKey: selectedAgent?.apiKey || '',
    };

    createSession(config, models);
  };

  const currentModels = getSelectedAgentModels();
  const selectedAgentObj = detectedAgents.find((a) => a.id === selectedAgentId);

  const enableLevel = (level: string, enabled: boolean) => {
    const subRoles = SUB_ROLES_BY_LEVEL[level] || [];
    setAgentInstances((prev) => prev.map((a) => {
      if (level === 'contributor' && CORE_CONTRIBUTOR_ROLES.includes(a.subRole)) {
        return { ...a, enabled };
      }
      if (subRoles.includes(a.subRole)) {
        return { ...a, enabled };
      }
      return a;
    }));
  };

  const LevelSection = ({ level }: { level: string }) => {
    const subRoles = SUB_ROLES_BY_LEVEL[level] || [];
    const levelInfo = LEVEL_LABELS[level as keyof typeof LEVEL_LABELS];
    const instances = agentInstances.filter((a) => a.subRole && a.subRole !== 'skeptic' && SUB_ROLE_LEVEL[a.subRole] === level && a.enabled);

    return (
      <div style={styles.levelSection}>
        <div style={styles.levelHeader}>
          <span style={styles.levelBadge}>{levelInfo?.cn || level}</span>
          <span style={styles.levelDesc}>{levelInfo?.desc || ''}</span>
          <button onClick={() => enableLevel(level, false)} style={styles.hideBtn}>全部移除</button>
          <button onClick={() => enableLevel(level, true)} style={styles.addAllBtn}>全部添加</button>
        </div>
        {instances.length === 0 && <p style={styles.noAgent}>（无参与者）</p>}
        {instances.map((inst) => {
          const label = SUB_ROLE_LABELS[inst.subRole];
          return (
            <div key={inst.id} style={{ ...styles.instanceRow, borderLeftColor: inst.color }}>
              <div style={styles.instanceInfo}>
                <span style={{ ...styles.instanceStyle, color: inst.color }}>
                  {label?.cn || inst.subRole}
                </span>
                {currentModels.length > 0 && (
                  <select value={inst.model} onChange={(e) => updateInstance(inst.id, { model: e.target.value })} style={styles.instanceModelSelect}>
                    {currentModels.map((m) => (<option key={m} value={m}>{m}</option>))}
                  </select>
                )}
                <input
                  style={styles.perspectiveInput}
                  placeholder={`具体视角（如：${level === 'contributor' ? '支付/用户/订单' : level === 'management' ? '团队A/平台组/产研中心' : '公司层面'}）`}
                  value={inst.perspective}
                  onChange={(e) => updateInstance(inst.id, { perspective: e.target.value, label: e.target.value || label?.cn || inst.subRole })}
                />
              </div>
              <div style={styles.instanceActions}>
                <button onClick={() => removeInstance(inst.id)} style={styles.removeBtn}>✕</button>
              </div>
            </div>
          );
        })}
        {/* Add buttons for this level */}
        <div style={styles.addAgentRow}>
          {level === 'contributor' && (
            <>
              {OPTIONAL_CONTRIBUTOR_ROLES.map((sr) => (
                <button
                  key={sr}
                  onClick={() => addInstance(sr)}
                  style={{ ...styles.addStyleBtn, borderColor: SUB_ROLE_COLORS[sr], color: SUB_ROLE_COLORS[sr] }}
                >
                  +{SUB_ROLE_LABELS[sr].cn}
                </button>
              ))}
            </>
          )}
          {level !== 'contributor' && subRoles.map((sr) => {
            if (agentInstances.some((a) => a.subRole === sr && a.enabled)) return null;
            return (
              <button
                key={sr}
                onClick={() => addInstance(sr)}
                style={{ ...styles.addStyleBtn, borderColor: SUB_ROLE_COLORS[sr], color: SUB_ROLE_COLORS[sr] }}
              >
                +{SUB_ROLE_LABELS[sr].cn}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Team Root Cause Analysis</h1>
          <p style={styles.subtitle}>Multi-level, multi-role root cause analysis workshop</p>
          {configError && <p style={styles.error}>{configError}</p>}
          {selectedAgentObj && (
            <p style={styles.providerBadge}>
              AI: {selectedAgentObj.name} · {selectedAgentObj.models.length} models
            </p>
          )}
        </div>

        <div style={styles.form}>
          {/* Topic */}
          <div style={styles.field}>
            <label style={styles.label}>事故/问题描述</label>
            <textarea
              style={styles.textarea}
              placeholder="描述要分析的事故或问题。包括：发生了什么、什么时间、影响范围、严重程度。"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={4}
            />
          </div>

          {/* Supplementary info */}
          <div style={styles.field}>
            <label style={styles.label}>补充信息（可选，每行一条）</label>
            <textarea
              style={{ ...styles.textarea, fontSize: 13 }}
              placeholder="日志、监控截图要点、操作记录等事实信息&#10;例如：&#10;14:00: 订单服务 CPU 从 30% 飙升到 95%&#10;14:05: 收到第一个超时告警"
              value={subTopicsText}
              onChange={(e) => setSubTopicsText(e.target.value)}
              rows={3}
            />
          </div>

          {/* RCA Method — 多选 toggle */}
          <div style={styles.field}>
            <label style={styles.label}>RCA 分析方法 <span style={styles.labelHint}>（可多选，选多个即混合模式）</span></label>
            <div style={styles.modes}>
              {RCA_METHODS.map((method) => {
                const info = RCA_METHOD_LABELS[method];
                const active = rcaMethods.includes(method);
                return (
                  <button
                    key={method}
                    onClick={() => {
                      setRcaMethods((prev) =>
                        prev.includes(method)
                          ? prev.filter((m) => m !== method)
                          : [...prev, method]
                      );
                    }}
                    style={{
                      ...styles.modeBtn,
                      ...(active ? styles.modeBtnActive : {}),
                    }}
                  >
                    <strong>
                      {active ? '✅ ' : ''}{info.cn}
                    </strong>
                    <span style={styles.modeDesc}>{info.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intervention Mode */}
          <div style={styles.field}>
            <label style={styles.label}>干预模式</label>
            <div style={styles.modes}>
              {[
                { value: 'smart_pause' as const, label: '🧠 Smart Pause', desc: '在分歧和关键决策时暂停询问' },
                { value: 'automatic' as const, label: '🤖 Fully Auto', desc: '全自动运行，不需干预' },
                { value: 'manual' as const, label: '🎮 Manual', desc: '每一步都需要确认' },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  style={{ ...styles.modeBtn, ...(mode === m.value ? styles.modeBtnActive : {}) }}
                >
                  <strong>{m.label}</strong>
                  <span style={styles.modeDesc}>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Backend */}
          <div style={styles.field}>
            <label style={styles.label}>AI 后端 / LLM 供应商</label>
            {loadingAgents ? (
              <p style={styles.loadingModels}>检测本地 AI Agent...</p>
            ) : detectedAgents.length === 0 ? (
              <p style={{ ...styles.loadingModels, color: '#f44336' }}>未检测到本地 AI Agent</p>
            ) : (
              <div style={styles.agentList}>
                {detectedAgents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => handleAgentChange(agent.id)}
                    style={{
                      ...styles.agentCard,
                      ...(selectedAgentId === agent.id ? styles.agentCardActive : {}),
                    }}
                  >
                    <div style={styles.agentCardHeader}>
                      <input
                        type="radio"
                        checked={selectedAgentId === agent.id}
                        onChange={() => handleAgentChange(agent.id)}
                        style={{ accentColor: '#667eea' }}
                      />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{agent.name}</span>
                      <span style={styles.sourceTag}>{agent.source}</span>
                    </div>
                    <div style={styles.agentCardMeta}>
                      <span style={styles.agentCardDesc}>{agent.description}</span>
                      <span style={styles.agentCardModels}>{agent.models.length > 0 ? `${agent.models.length} 个模型可用` : '获取模型中...'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Participants by Level */}
          <div style={styles.field}>
            <label style={styles.label}>参与者配置 <span style={styles.labelHint}>（按层级组织，每层级可选多个具体角色）</span></label>

            {/* 一键设置全部模型 */}
            {currentModels.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: '#4f46e5', width: 100, whiteSpace: 'nowrap' }}>⚡ 设为全部</span>
                <select value={agentInstances[0]?.model || currentModels[0]}
                  onChange={(e) => {
                    const val = e.target.value;
                    agentInstances.forEach((inst) => updateInstance(inst.id, { model: val }));
                  }}
                  style={{ flex: 1, padding: '2px 6px', borderRadius: 4, border: '1px solid #c7d2fe', fontSize: 12, background: 'white' }}>
                  {currentModels.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
                <button onClick={() => {
                  const model = agentInstances[0]?.model || currentModels[0];
                  agentInstances.forEach((inst) => updateInstance(inst.id, { model }));
                }} style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: '#4f46e5', color: 'white', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                }}>应用到全部</button>
              </div>
            )}
            {/* Facilitator (always shown) */}
            <div style={styles.levelSection}>
              <div style={styles.levelHeader}>
                <span style={{ ...styles.levelBadge, background: '#9E9E9E' }}>引导者</span>
                <span style={styles.levelDesc}>掌控节奏，不参与具体分析</span>
              </div>
              {agentInstances.filter((a) => a.level === 'facilitator').map((inst) => (
                <div key={inst.id} style={{ ...styles.instanceRow, borderLeftColor: '#9E9E9E', opacity: 0.8 }}>
                  <div style={styles.instanceInfo}>
                    <span style={{ ...styles.instanceStyle, color: '#9E9E9E' }}>引导者</span>
                    {currentModels.length > 0 && (
                      <select value={inst.model} onChange={(e) => updateInstance(inst.id, { model: e.target.value })} style={styles.instanceModelSelect}>
                        {currentModels.map((m) => (<option key={m} value={m}>{m}</option>))}
                      </select>
                    )}
                  </div>
                  <div style={styles.instanceActions}>
                    <span style={styles.instanceId}>必选</span>
                  </div>
                </div>
              ))}
            </div>

            <LevelSection level="contributor" />

            <div style={styles.levelDivider}>
              <span style={styles.levelDividerText}>上层视角（可选，按需添加）</span>
            </div>

            <LevelSection level="management" />
            <LevelSection level="executive" />

            {/* Skeptic - separate meta role */}
            <div style={styles.levelSection}>
              <div style={styles.levelHeader}>
                <span style={{ ...styles.levelBadge, background: '#F44336' }}>质疑者</span>
                <span style={styles.levelDesc}>挑战假设，防止确认偏差（跨层级的元角色）</span>
              </div>
              {agentInstances.filter((a) => a.subRole === 'skeptic').length === 0 ? (
                <div style={styles.addAgentRow}>
                  <button
                    onClick={() => addInstance('skeptic' as SubRole)}
                    style={{ ...styles.addStyleBtn, borderColor: '#F44336', color: '#F44336' }}
                  >
                    +质疑者
                  </button>
                </div>
              ) : agentInstances.filter((a) => a.subRole === 'skeptic').map((inst) => (
                <div key={inst.id} style={{ ...styles.instanceRow, borderLeftColor: '#F44336' }}>
                  <div style={styles.instanceInfo}>
                    <span style={{ ...styles.instanceStyle, color: '#F44336' }}>质疑者</span>
                    {currentModels.length > 0 && (
                      <select value={inst.model} onChange={(e) => updateInstance(inst.id, { model: e.target.value })} style={styles.instanceModelSelect}>
                        {currentModels.map((m) => (<option key={m} value={m}>{m}</option>))}
                      </select>
                    )}
                    <input
                      style={styles.perspectiveInput}
                      placeholder="侧重方向"
                      value={inst.perspective}
                      onChange={(e) => updateInstance(inst.id, { perspective: e.target.value })}
                    />
                  </div>
                  <div style={styles.instanceActions}>
                    <button onClick={() => removeInstance(inst.id)} style={styles.removeBtn}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!topic.trim() || !wsConnected}
            style={{
              ...styles.startBtn,
              opacity: topic.trim() && wsConnected ? 1 : 0.5,
              cursor: topic.trim() && wsConnected ? 'pointer' : 'not-allowed',
            }}
          >
            {wsConnected ? '🔍 开始根因分析' : '⏳ 连接服务器中...'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: '100vw', height: '100vh', overflow: 'auto',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    padding: '20px 0',
  },
  card: {
    background: 'white', borderRadius: 16, padding: '24px 32px',
    width: 720, maxWidth: '90vw', marginBottom: 40,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: { marginBottom: 24, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: 700, color: '#333' },
  subtitle: { color: '#888', marginTop: 8, fontSize: 14 },
  error: { color: '#f44336', fontSize: 13, marginTop: 8 },
  providerBadge: {
    display: 'inline-block', marginTop: 8, padding: '2px 10px',
    background: '#e8f5e9', borderRadius: 12, fontSize: 12, color: '#2e7d32',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontWeight: 600, color: '#555', fontSize: 14 },
  labelHint: { fontWeight: 400, fontSize: 12, color: '#999' },
  textarea: {
    padding: 12, borderRadius: 8, border: '1px solid #ddd',
    fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  modes: { display: 'flex', flexDirection: 'column', gap: 8 },
  modeBtn: {
    padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0',
    background: '#fafafa', cursor: 'pointer', textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  modeBtnActive: { borderColor: '#667eea', background: '#f0f0ff' },
  modeDesc: { fontSize: 12, color: '#888' },
  agentList: { display: 'flex', flexDirection: 'column', gap: 8 },
  agentCard: {
    padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0',
    background: '#fafafa', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
  },
  agentCardActive: { borderColor: '#667eea', background: '#f0f0ff' },
  agentCardHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  sourceTag: {
    padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
    background: '#e0e0e0', color: '#666', textTransform: 'uppercase',
  },
  agentCardMeta: { display: 'flex', justifyContent: 'space-between', marginLeft: 24 },
  agentCardDesc: { fontSize: 12, color: '#888' },
  agentCardModels: { fontSize: 12, color: '#667eea', fontWeight: 600 },
  instanceModelSelect: {
    padding: '2px 6px', borderRadius: 6, border: '1px solid #ddd',
    fontSize: 11, background: 'white', maxWidth: 140,
  },
  loadingModels: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  // level sections
  levelSection: {
    padding: '10px 12px', background: '#fafafa', borderRadius: 10,
    marginBottom: 8,
  },
  levelHeader: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
    flexWrap: 'wrap',
  },
  levelBadge: {
    padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
    background: '#5C6BC0', color: 'white',
  },
  levelDesc: { fontSize: 11, color: '#888', flex: 1 },
  hideBtn: {
    fontSize: 11, padding: '2px 8px', borderRadius: 4,
    border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer',
    color: '#999',
  },
  addAllBtn: {
    fontSize: 11, padding: '2px 8px', borderRadius: 4,
    border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer',
    color: '#667eea',
  },
  levelDivider: {
    textAlign: 'center', padding: '12px 0 8px',
    borderTop: '1px dashed #e0e0e0', marginTop: 4,
  },
  levelDividerText: { fontSize: 11, color: '#bbb', fontWeight: 600 },
  noAgent: { fontSize: 12, color: '#ccc', fontStyle: 'italic', padding: '4px 8px' },
  // instances
  instanceList: { display: 'flex', flexDirection: 'column', gap: 6 },
  instanceRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 10px', background: 'white', borderRadius: 8,
    borderLeft: '3px solid', marginBottom: 4,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  instanceInfo: { display: 'flex', alignItems: 'center', gap: 8, flex: 1 },
  instanceStyle: { fontWeight: 600, fontSize: 13, minWidth: 90 },
  perspectiveInput: {
    flex: 1, padding: '4px 8px', borderRadius: 6,
    border: '1px solid #ddd', fontSize: 12, background: 'white',
  },
  instanceActions: { display: 'flex', alignItems: 'center', gap: 6 },
  instanceId: { fontSize: 10, color: '#bbb', fontFamily: 'monospace' },
  removeBtn: {
    width: 20, height: 20, borderRadius: '50%', border: 'none',
    background: '#ffebee', color: '#f44336', fontSize: 12,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  addAgentRow: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
    padding: '4px 0',
  },
  addStyleBtn: {
    padding: '3px 10px', borderRadius: 12, border: '1px solid',
    background: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600,
  },
  startBtn: {
    padding: '14px 24px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white', fontSize: 16, fontWeight: 600,
  },
};
