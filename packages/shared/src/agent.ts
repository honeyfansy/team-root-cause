/**
 * RCA 角色系统：层级（Level） × 具体岗位（SubRole）
 *
 * Level 决定「看得多高」 — 归因层次
 * SubRole 决定「看什么方向」 — 专业领域
 *
 * contributor（执行层）— 一线工程师/成员，聚焦技术细节
 * management（管理层）— 团队/项目/资源管理者，聚焦流程和决策
 * executive（决策层）— 高管，聚焦文化和战略
 */

// ──────────── 层级 ────────────
export type Level = 'contributor' | 'management' | 'executive' | 'facilitator';

export const LEVEL_LABELS: Record<Level, { cn: string; desc: string }> = {
  contributor: { cn: '执行层', desc: '一线工程师/成员，技术细节和实施层面' },
  management:  { cn: '管理层', desc: '团队负责人/经理/总监，流程决策和资源组织层面' },
  executive:   { cn: '决策层', desc: '高管，文化和战略层面' },
  facilitator: { cn: '引导者', desc: '掌控节奏，不参与具体分析' },
};

// ──────────── 具体岗位 ────────────
export type SubRole =
  // 元角色
  | 'skeptic'
  // contributor 层
  | 'backend' | 'frontend' | 'qa' | 'sre' | 'product'
  // management 层（原 owner + manager 合并）
  | 'tech_lead' | 'feature_owner' | 'project_manager' | 'scrum_master'
  | 'pm' | 'engineering_manager' | 'director' | 'architect'
  // executive 层
  | 'cto' | 'vp_engineering' | 'board_rep';

export const SUB_ROLE_LABELS: Record<SubRole, { cn: string; desc: string }> = {
  // 元角色
  skeptic:            { cn: '质疑者', desc: '假设检验、替代解释、深层追问、确认偏差' },
  // contributor
  backend:            { cn: '后端工程师', desc: '服务端逻辑、API、数据库、系统架构' },
  frontend:           { cn: '前端工程师', desc: '用户界面、客户端逻辑、交互体验' },
  qa:                 { cn: '测试/QA', desc: '测试覆盖、测试环境、回归流程、发布质量' },
  sre:                { cn: '运维/SRE', desc: '基础设施、监控、部署、容量、可观测性' },
  product:            { cn: '产品', desc: '产品细节、需求理解、用户影响分析' },
  // management（原 owner + manager 合并）
  tech_lead:          { cn: '技术负责人', desc: '技术决策、架构选型、团队协作、代码质量' },
  feature_owner:      { cn: 'Feature Owner', desc: '特性交付、跨职能协调、需求落地' },
  project_manager:    { cn: '项目经理', desc: '项目进度、资源协调、风险管控' },
  scrum_master:       { cn: 'Scrum Master', desc: '敏捷流程、团队效能、障碍清除' },
  pm:                 { cn: '产品经理', desc: '需求定义、验收标准、业务目标、用户价值' },
  engineering_manager: { cn: '技术经理', desc: '团队建设、绩效管理、资源分配、跨团队协调' },
  director:           { cn: '技术总监', desc: '技术方向、组织能力建设、跨部门协作' },
  architect:          { cn: '架构师', desc: '系统架构、技术规范、技术债管理、技术评审' },
  // executive
  cto:                { cn: 'CTO', desc: '技术战略、组织文化、技术投资、创新方向' },
  vp_engineering:     { cn: 'VP Engineering', desc: '工程效率、技术团队建设、跨职能战略' },
  board_rep:          { cn: '总裁办代表', desc: '业务视角、组织层面问责、系统性改进' },
};

export const SUB_ROLE_COLORS: Record<SubRole, string> = {
  // 元角色
  skeptic:             '#F44336',
  // contributor
  backend:             '#4A90D9',
  frontend:            '#7B61FF',
  qa:                  '#4CAF50',
  sre:                 '#00BCD4',
  product:             '#FFA726',
  // management（原 owner + manager 合并）
  tech_lead:           '#2196F3',
  feature_owner:       '#9C27B0',
  project_manager:     '#FF5722',
  scrum_master:        '#607D8B',
  pm:                  '#FF9800',
  engineering_manager: '#3F51B5',
  director:            '#E91E63',
  architect:           '#795548',
  // executive
  cto:                 '#F44336',
  vp_engineering:      '#D32F2F',
  board_rep:           '#B71C1C',
};

/** 每个 SubRole 所属的 Level */
export const SUB_ROLE_LEVEL: Record<SubRole, Level> = {
  skeptic:             'contributor',
  backend:             'contributor',
  frontend:            'contributor',
  qa:                  'contributor',
  sre:                 'contributor',
  product:             'contributor',
  tech_lead:           'management',
  feature_owner:       'management',
  project_manager:     'management',
  scrum_master:        'management',
  pm:                  'management',
  engineering_manager: 'management',
  director:            'management',
  architect:           'contributor',
  cto:                 'executive',
  vp_engineering:      'executive',
  board_rep:           'executive',
};

/** contributor 层默认选中的核心角色 */
export const CORE_CONTRIBUTOR_ROLES: SubRole[] = ['backend', 'frontend', 'qa'];

/** contributor 层可选的非核心角色 */
export const OPTIONAL_CONTRIBUTOR_ROLES: SubRole[] = ['sre', 'product'];

/** 每个角色的默认预设视角 */
export const SUB_ROLE_PERSPECTIVE_PRESETS: Record<SubRole, string> = {
  skeptic:             '假设检验 — 挑战假设，寻找替代解释',
  // contributor
  backend:             '后端服务 — API、业务逻辑、数据库、性能与可用性层面分析',
  frontend:            '前端 — 状态管理、渲染性能、API 集成、用户体验与构建部署分析',
  qa:                  '测试与质量 — 测试策略、自动化覆盖、环境数据与回归流程分析',
  sre:                 '基础设施/监控/部署 — 系统可观测性与容量分析',
  product:             '产品 — 用户行为、业务影响、优先级决策与需求沟通分析',
  // management
  tech_lead:           '技术决策 — 技术方案、架构演进、代码质量与团队技术建设分析',
  feature_owner:       '特性交付 — 需求落地、范围管理、跨职能协调与干系人沟通分析',
  project_manager:     '项目进度与风险 — 资源协调与进度管控分析',
  scrum_master:        '敏捷流程 — 团队流程与效能障碍分析',
  pm:                  '产品管理 — 需求定义、业务目标、用户价值与优先级决策分析',
  engineering_manager: '团队建设 — 绩效管理与资源分配分析',
  director:            '技术方向 — 组织能力与跨部门协作分析',
  architect:           '系统架构 — 技术规范、跨系统集成、技术选型与架构评审分析',
  // executive
  cto:                 '技术战略 — 组织文化与技术投资分析',
  vp_engineering:      '工程效率 — 跨职能战略与团队建设分析',
  board_rep:           '业务视角 — 组织层面问责与系统性改进分析',
};

// ──────────── RCA 方法 ────────────
export type RCAMethod = 'five_whys' | 'fishbone' | 'fta' | 'mixed';

export const RCA_METHOD_LABELS: Record<RCAMethod, { cn: string; desc: string }> = {
  five_whys: { cn: '5 Whys', desc: '逐层追问"为什么"，从表层症状深挖到根本原因' },
  fishbone:  { cn: '鱼骨图（Ishikawa）', desc: '从 6M 维度系统排查原因' },
  fta:       { cn: '故障树（FTA）', desc: '自上而下的逻辑树分解故障事件' },
  mixed:     { cn: '混合模式', desc: '各角色选择最适合的分析方法' },
};

// ──────────── Agent 基础类型 ────────────
export type AgentStatusType = 'idle' | 'thinking' | 'speaking' | 'waiting' | 'done' | 'error';

export interface AgentStatusInfo {
  agentId: string;
  level: Level;
  subRole: SubRole;
  perspective: string;
  label: string;
  color: string;
  model: string;
  status: AgentStatusType;
  message?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface RCAAgentConfig {
  id: string;
  level: Level;
  subRole: SubRole;
  perspective: string;
  label: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  color: string;
  enabled: boolean;
}

// ──────────── 通信类型 ────────────
export interface AgentMessage {
  id: string;
  sessionId: string;
  from: string;
  to: string | 'all' | 'user';
  content: string;
  phase: string;
  timestamp: number;
  type: 'thought' | 'question' | 'decision' | 'action' | 'chat';
  actions?: CanvasAction[];
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentThought {
  agentId: string;
  content: string;
  phase: string;
  visible: boolean;
}

export interface CanvasAction {
  type:
    | 'add_card'
    | 'add_cards'
    | 'remove_card'
    | 'update_card'
    | 'add_edge'
    | 'remove_edge'
    | 'invite_agent'
    | 'invite_all'
    | 'advance_phase'
    | 'request_decision'
    | 'wait_for_user'
    | 'summarize'
    | 'propose_card'
    | 'propose_edges'
    | 'disagree'
    | 'agree';
  payload: Record<string, unknown>;
}

export interface DecisionRequest {
  id: string;
  sessionId: string;
  phase: string;
  title: string;
  description: string;
  context: string[];
  options: DecisionOption[];
  from: string[];
  status: 'pending' | 'resolved' | 'skipped';
  createdAt: number;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
}

export interface DecisionResponse {
  requestId: string;
  optionId?: string;
  customInput?: string;
  action: 'select' | 'skip' | 'custom';
}
