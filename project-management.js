/**
 * Project Management Module
 * Handles project creation, switching, and lifecycle management
 */

export class ProjectManagement {
  constructor(dataPersistence, memorySync) {
    this.dataPersistence = dataPersistence;
    this.memorySync = memorySync;
    this.activeProject = null;
  }

  async createProject(args) {
    try {
      const {
        project_id,
        goal,
        specific_interests = [],
        learning_paths = [],
        context = "",
        constraints = {},
        existing_credentials = [],
        current_habits = {},
        life_structure_preferences,
        urgency_level = "medium",
        success_metrics = [],
      } = args;

      if (!project_id || !goal || !life_structure_preferences) {
        throw new Error(
          "Missing required fields: project_id, goal, and life_structure_preferences are required",
        );
      }

      // Calculate knowledge boost from existing credentials
      const { knowledgeLevel, skillMappings } = this.calculateKnowledgeBoost(
        existing_credentials,
        goal,
      );

      const projectConfig = {
        id: project_id,
        goal,
        specific_interests,
        learning_paths:
          learning_paths.length > 0
            ? learning_paths
            : [{ path_name: "general", priority: "high" }],
        context,
        constraints,
        existing_credentials,
        current_habits,
        life_structure_preferences,
        urgency_level,
        success_metrics,
        created_at: new Date().toISOString(),
        knowledge_level: knowledgeLevel,
        skill_mappings: skillMappings,
        progress: 0,
        activePath:
          learning_paths.length > 0 ? learning_paths[0].path_name : "general",
      };

      // Save project configuration
      await this.dataPersistence.saveProjectData(
        project_id,
        "config.json",
        projectConfig,
      );

      // Update global configuration
      const globalData = (await this.dataPersistence.loadGlobalData(
        "config.json",
      )) || { projects: [] };
      if (!globalData.projects.includes(project_id)) {
        globalData.projects.push(project_id);
      }
      globalData.activeProject = project_id;
      await this.dataPersistence.saveGlobalData("config.json", globalData);

      // Set as active project
      this.activeProject = project_id;

      // Sync to memory
      const memoryData =
        await this.memorySync.syncActiveProjectToMemory(project_id);

      return {
        content: [
          {
            type: "text",
            text:
              `🎯 Project "${project_id}" created successfully!\n\n` +
              `**Goal**: ${goal}\n` +
              `**Knowledge Level**: ${knowledgeLevel}/10\n` +
              `**Learning Paths**: ${learning_paths.map((p) => p.path_name).join(", ") || "general"}\n` +
              `**Focus Duration**: ${life_structure_preferences.focus_duration || "flexible"}\n` +
              `**Wake Time**: ${life_structure_preferences.wake_time || "not specified"}\n\n` +
              `✅ Ready to build HTA tree and start learning!`,
          },
        ],
        project_created: projectConfig,
        forest_memory_sync: memoryData,
      };
    } catch (error) {
      await this.dataPersistence.logError("createProject", error, args);
      return {
        content: [
          {
            type: "text",
            text: `Error creating project: ${error.message}`,
          },
        ],
      };
    }
  }

  async switchProject(projectId) {
    try {
      const config = await this.dataPersistence.loadProjectData(
        projectId,
        "config.json",
      );
      if (!config) {
        throw new Error(`Project "${projectId}" not found`);
      }

      // Update global configuration
      const globalData =
        (await this.dataPersistence.loadGlobalData("config.json")) || {};
      globalData.activeProject = projectId;
      await this.dataPersistence.saveGlobalData("config.json", globalData);

      // Set as active project
      this.activeProject = projectId;

      // Sync to memory
      const memoryData =
        await this.memorySync.syncActiveProjectToMemory(projectId);

      return {
        content: [
          {
            type: "text",
            text:
              `🔄 Switched to project: **${projectId}**\n\n` +
              `**Goal**: ${config.goal}\n` +
              `**Progress**: ${config.progress || 0}%\n` +
              `**Active Path**: ${config.activePath || "general"}\n\n` +
              `✅ Project context loaded and synced to memory!`,
          },
        ],
        active_project: config,
        forest_memory_sync: memoryData,
      };
    } catch (error) {
      await this.dataPersistence.logError("switchProject", error, {
        projectId,
      });
      return {
        content: [
          {
            type: "text",
            text: `Error switching project: ${error.message}`,
          },
        ],
      };
    }
  }

  async listProjects() {
    try {
      const globalData = (await this.dataPersistence.loadGlobalData(
        "config.json",
      )) || { projects: [] };
      const activeProject = globalData.activeProject;

      if (globalData.projects.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "📂 No projects found. Create your first project to get started!",
            },
          ],
        };
      }

      let projectList = "📂 **Available Projects:**\n\n";
      for (const projectId of globalData.projects) {
        const config = await this.dataPersistence.loadProjectData(
          projectId,
          "config.json",
        );
        const isActive = projectId === activeProject ? " 🎯 **ACTIVE**" : "";
        const progress = config?.progress || 0;

        projectList += `• **${projectId}**${isActive}\n`;
        projectList += `  Goal: ${config?.goal || "Unknown"}\n`;
        projectList += `  Progress: ${progress}%\n\n`;
      }

      return {
        content: [
          {
            type: "text",
            text: projectList,
          },
        ],
        projects: globalData.projects,
        active_project: activeProject,
      };
    } catch (error) {
      await this.dataPersistence.logError("listProjects", error);
      return {
        content: [
          {
            type: "text",
            text: `Error listing projects: ${error.message}`,
          },
        ],
      };
    }
  }

  async getActiveProject() {
    try {
      const globalData =
        (await this.dataPersistence.loadGlobalData("config.json")) || {};
      const activeProjectId = globalData.activeProject;

      if (!activeProjectId) {
        return {
          content: [
            {
              type: "text",
              text: "❌ No active project. Use `create_project` or `switch_project` first.",
            },
          ],
        };
      }

      const config = await this.dataPersistence.loadProjectData(
        activeProjectId,
        "config.json",
      );
      if (!config) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Active project "${activeProjectId}" configuration not found.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text:
              `🎯 **Active Project**: ${activeProjectId}\n\n` +
              `**Goal**: ${config.goal}\n` +
              `**Context**: ${config.context || "Not specified"}\n` +
              `**Knowledge Level**: ${config.knowledge_level || "Unknown"}/10\n` +
              `**Active Path**: ${config.activePath || "general"}\n` +
              `**Schedule**: ${config.life_structure_preferences?.wake_time || "Flexible"} - ${config.life_structure_preferences?.sleep_time || "Flexible"}`,
          },
        ],
        active_project: config,
      };
    } catch (error) {
      await this.dataPersistence.logError("getActiveProject", error);
      return {
        content: [
          {
            type: "text",
            text: `Error getting active project: ${error.message}`,
          },
        ],
      };
    }
  }

  async requireActiveProject() {
    const globalData =
      (await this.dataPersistence.loadGlobalData("config.json")) || {};

    // STRICT: Only use activeProject field (consistent naming)
    const activeProjectId = globalData.activeProject;

    if (!activeProjectId) {
      throw new Error(
        "No active project. Create or switch to a project first.",
      );
    }

    // VALIDATE: Ensure project actually exists
    const projectConfig = await this.dataPersistence.loadProjectData(
      activeProjectId,
      "config.json",
    );
    if (!projectConfig) {
      throw new Error(
        `Active project "${activeProjectId}" not found. Project data may be corrupted.`,
      );
    }

    // ISOLATE: Set active project in memory
    this.activeProject = activeProjectId;
    return activeProjectId;
  }

  calculateKnowledgeBoost(existingCredentials, goal) {
    let knowledgeLevel = 1; // Base level
    const skillMappings = {};

    for (const credential of existingCredentials) {
      const relevanceScore = this.assessRelevance(credential, goal);
      const levelBoost = this.getLevelBoost(credential.level);

      knowledgeLevel += relevanceScore * levelBoost;

      if (relevanceScore > 0.3) {
        skillMappings[credential.subject_area] = {
          level: credential.level,
          relevance: relevanceScore,
          boost: relevanceScore * levelBoost,
        };
      }
    }

    return {
      knowledgeLevel: Math.min(knowledgeLevel, 10), // Cap at 10
      skillMappings,
    };
  }

  assessRelevance(credential, goal) {
    const goalLower = goal.toLowerCase();
    const subjectLower = credential.subject_area.toLowerCase();
    const relevanceLower = (credential.relevance_to_goal || "").toLowerCase();

    // Direct subject match
    if (goalLower.includes(subjectLower) || subjectLower.includes(goalLower)) {
      return 1.0;
    }

    // High relevance stated
    if (
      relevanceLower.includes("directly related") ||
      relevanceLower.includes("very relevant")
    ) {
      return 0.8;
    }

    // Medium relevance
    if (
      relevanceLower.includes("somewhat") ||
      relevanceLower.includes("partially")
    ) {
      return 0.5;
    }

    // Check for common skill overlaps
    const skillOverlaps = this.mapCredentialsToSkills(
      credential.subject_area,
      goal,
    );
    return skillOverlaps;
  }

  getLevelBoost(level) {
    const levelLower = level.toLowerCase();
    if (levelLower.includes("expert") || levelLower.includes("advanced"))
      return 2.0;
    if (levelLower.includes("intermediate")) return 1.5;
    if (levelLower.includes("beginner")) return 1.0;
    return 1.2; // Default for unspecified
  }

  async mapCredentialsToSkills(subjectArea, goal) {
    if (this.claude && typeof this.claude.requestIntelligence === "function") {
      try {
        const response = await this.claude.requestIntelligence("credentials-to-skills-mapping", {
          subjectArea,
          goal,
        });
        if (response && typeof response.score === "number") {
          return response.score;
        }
        if (response && response.data && typeof response.data.score === "number") {
          return response.data.score;
        }
      } catch (err) {
        console.error("⚠️ Claude credentials-to-skills-mapping request failed, falling back to generic mapping:", String(err));
        // continue to fallback below
      }
    }
    // Minimal generic fallback
    return 0.1;
  }
}
