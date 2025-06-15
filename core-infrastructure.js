/**
 * Core Infrastructure Module
 * Handles server initialization, dependencies, and basic setup
 */

// eslint-disable-next-line import/no-unresolved, node/no-missing-import
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
/* eslint-disable import/no-unresolved, node/no-missing-import */
// The Stdio transport is imported where it is used (server-modular.js).
import fs from "fs/promises";
import path from "path";
import os from "os";
import http from "http";

// The MCP server operates over SDK transports (stdio, etc.) — not HTTP.
// Disable the auxiliary HTTP status endpoint by default.
const ENABLE_HTTP_API = false;

export class CoreInfrastructure {
  constructor() {
    this.server = new Server(
      {
        name: "forest-server",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Decide on a guaranteed-writable data directory.
    // 1. If FOREST_DATA_DIR is set, use that.
    // 2. Otherwise default to ~/.forest-data (cross-platform writable location).
    this.dataDir = process.env.FOREST_DATA_DIR
      ? path.resolve(process.env.FOREST_DATA_DIR)
      : path.join(os.homedir(), ".forest-data");

    this.activeProject = null;

    // Lightweight ClaudeInterface wrapper for contextual intelligence requests
    /**
     * @type {{
     *   requestIntelligence: (
     *     type: string,
     *     payload: any,
     *   ) => Promise<any>
     * }}
     */
    this.claudeInterface = {
      /**
       * Very-lightweight heuristic substitute for Claude.
       * Generates context-aware mock data so downstream modules don't fall back to generic placeholders.
       *
       * NOTE: Replace with real Claude calls when available.
       */
      async requestIntelligence(type, payload) {
        try {
          switch (type) {
            case "branch-design": {
              // Extract a few keywords from the goal / path to shape branches
              const goalText = String(payload.goal || "general").toLowerCase();
              const path = String(payload.pathName || "general").toLowerCase();
              const focus = (payload.focusAreas || []).map((/** @type {any} */ f) => String(f).toLowerCase());

              /** @type {string[]} */
              const keywords = [goalText, path, ...focus].join(" ").split(/[^a-z]+/);
              const hasCrisis = keywords.includes("crisis") || keywords.includes("emergency");
              const hasRelationship = keywords.includes("relationship") || keywords.includes("sydney");
              const hasSystem = keywords.includes("system") || keywords.includes("daily");

              /** @type {any[]} */
              const branches = [];
              let idCounter = 1;
              /**
               * Push a branch definition into the list.
               * @param {string} id
               * @param {string} title
               * @param {string} [priority="high"]
               */
              const pushBranch = (id, title, priority = "high") => {
                branches.push({ id, title, priority, completed: false });
              };

              if (hasCrisis) pushBranch("crisis", "Crisis Prevention", "critical");
              if (hasRelationship) pushBranch("relationship", "Relationship Repair", "high");
              if (hasSystem) pushBranch("daily", "Daily Systems", "high");

              // Always include at least exploration / mastery arcs
              pushBranch("exploration", "Domain Exploration", "medium");
              pushBranch("mastery", "Advanced Mastery", "low");

              // Ensure unique ids
              branches.forEach((/** @type {{id: string}} */ b) => {
                if (!b.id) {
                  b.id = `branch_${idCounter++}`;
                }
              });

              return { branches };
            }

            case "branch-node-generation": {
              const { branch, startNodeId = 1 } = payload;
              /** @type {any[]} */ const nodes = [];
              const base = branch.id || "branch";
              const titles = [
                `Understand the fundamentals of ${branch.title}`,
                `Apply ${branch.title} in real-life scenario`,
                `Reflect on progress in ${branch.title}`,
              ];
              titles.forEach((/** @type {string} */ title, idx) => {
                nodes.push({
                  id: `${base}_${startNodeId + idx}`,
                  title,
                  description: title,
                  branch: branch.id,
                  difficulty: idx + 1,
                  duration: `${15 + idx * 15} minutes`,
                  prerequisites: idx === 0 ? [] : [`${base}_${startNodeId + idx - 1}`],
                  learningOutcome: `Gain competency: ${title}`,
                  completed: false,
                  priority: 200 - idx * 10,
                });
              });
              return { nodes };
            }

            case "task-generation": {
              const { config = {}, analysis = {} } = payload;
              const goal = String(config.goal || "General Growth");
              const tasks = [
                {
                  id: `task_${Date.now()}`,
                  title: `Deep-dive: ${goal.split(" ")[0]} fundamentals`,
                  description: `Investigate the foundational principles behind your goal: ${goal}`,
                  difficulty: 3,
                  duration: "45 minutes",
                  branch: "fundamentals",
                  priority: 220,
                  generated: true,
                },
                {
                  id: `task_${Date.now() + 1}`,
                  title: `Apply new insight to real crisis context`,
                  description: `Translate theory into practice based on current analysis (${analysis.recommendedEvolution || "optimize"}).`,
                  difficulty: 4,
                  duration: "30 minutes",
                  branch: "application",
                  priority: 210,
                  generated: true,
                },
              ];
              return { tasks };
            }

            case "next-task-selection": {
              // Provide a single task recommendation envelope
              return {
                content: [
                  {
                    type: "text",
                    text: "🎯 Recommended next task generated.",
                  },
                ],
                selected_task: {
                  id: `rec_${Date.now()}`,
                  title: "Emergency Brain Dump",
                  description: "Externalize urgent thoughts to regain focus",
                  difficulty: 2,
                  duration: "20 minutes",
                  branch: "crisis",
                  priority: 300,
                  generated: true,
                },
              };
            }

            case "role-inference":
            case "target-role-inference": {
              return { role: "professional" };
            }

            case "credentials-to-skills-mapping": {
              return { score: 0.5 };
            }

            default: {
              // Fallback: echo request for Claude
              return { request_for_claude: { type, payload } };
            }
          }
        } catch (err) {
          // On internal error, surface envelope so callers can still handle gracefully
          console.error("ClaudeInterface heuristic error:", err);
          return { request_for_claude: { type, payload } };
        }
      },
    };
  }

  getServer() {
    return this.server;
  }

  getDataDir() {
    return this.dataDir;
  }

  getActiveProject() {
    return this.activeProject;
  }

  /**
   * Set the active project ID.
   * @param {string} project - Project identifier to activate.
   */
  setActiveProject(project) {
    this.activeProject = project;
  }

  getClaudeInterface() {
    return this.claudeInterface;
  }

  isHttpApiEnabled() {
    return ENABLE_HTTP_API;
  }
}

export { ENABLE_HTTP_API };
