import type { RCAAgentConfig, SessionConfig } from '@team-root-cause/shared';
import { FacilitatorAgent } from './FacilitatorAgent.js';
import { RCAAgent } from './RCAAgent.js';
import { BaseAgent } from './BaseAgent.js';
import { AGENT_SYSTEM_PROMPTS } from '../orchestrator/phases.js';
import { SUB_ROLE_LEVEL } from '@team-root-cause/shared';

export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();
  private facilitatorId: string = '';

  constructor(config: SessionConfig) {
    for (const ac of config.agents) {
      if (!ac.enabled) continue;
      const detailedPrompt = AGENT_SYSTEM_PROMPTS[ac.subRole] || AGENT_SYSTEM_PROMPTS.default;
      const agent = this.createAgent({
        ...ac,
        systemPrompt: ac.systemPrompt || detailedPrompt,
      });
      if (agent) {
        this.agents.set(ac.id, agent);
        if (ac.level === 'facilitator') {
          this.facilitatorId = ac.id;
        }
      }
    }
  }

  private createAgent(ac: RCAAgentConfig): BaseAgent | null {
    if (ac.level === 'facilitator') {
      return new FacilitatorAgent(ac);
    }
    return new RCAAgent(ac);
  }

  get(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  getActiveAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  getBySubRole(subRole: string): BaseAgent[] {
    return this.getAll().filter((a) => a.config.subRole === subRole);
  }

  getByLevel(level: string): BaseAgent[] {
    return this.getAll().filter((a) => a.config.level === level);
  }

  getFacilitator(): BaseAgent | undefined {
    return this.agents.get(this.facilitatorId);
  }

  getNonFacilitator(): BaseAgent[] {
    return this.getAll().filter((a) => a.config.id !== this.facilitatorId);
  }
}
