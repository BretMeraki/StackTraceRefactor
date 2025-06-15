/**
 * HTA Tree Builder Module
 * Handles HTA tree construction and strategic task generation
 */

export class HtaTreeBuilder {
  /**
   * @param {any} dataPersistence - Data persistence layer abstraction.
   * @param {any} projectManagement - Project management module.
   * @param {any} [claudeInterface] - Optional Claude interface for intelligence requests.
   */
  constructor(
    /** @type {any} */ dataPersistence,
    /** @type {any} */ projectManagement,
    /** @type {any} */ claudeInterface = null,
  ) {
    this.dataPersistence = dataPersistence;
    this.projectManagement = projectManagement;
    this.claude = claudeInterface;
  }

  /**
   * Build or update the HTA tree for a given learning path.
   * @param {string|null} pathName - The learning path identifier or null to use the active path.
   * @param {string} [learningStyle] - Preferred learning style (e.g. "mixed", "visual").
   * @param {any[]} [focusAreas] - Optional list of focus areas to emphasize.
   */
  async buildHTATree(
    /** @type {string|null} */ pathName = null,
    learningStyle = "mixed",
    focusAreas = [],
  ) {
    try {
      const projectId = await this.projectManagement.requireActiveProject();
      const config = await this.dataPersistence.loadProjectData(
        projectId,
        "config.json",
      );

      if (!config) {
        throw new Error("Project configuration not found");
      }

      // Determine which path to build for
      const targetPath = pathName || config.activePath || "general";

      // Check if path exists in learning paths
      const pathExists =
        config.learning_paths?.some((/** @type {any} */ p) => p.path_name === targetPath) ||
        targetPath === "general";
      if (!pathExists) {
        throw new Error(
          `Learning path "${targetPath}" not found in project configuration`,
        );
      }

      // Load existing HTA data for this path
      const existingHTA = await this.loadPathHTA(projectId, targetPath);

      // Generate strategic framework
      const htaData = await this.generateHTAFramework(
        config,
        targetPath,
        learningStyle,
        focusAreas,
        existingHTA,
      );

      // Save HTA data
      await this.savePathHTA(projectId, targetPath, htaData);

      // Update project config with active path
      config.activePath = targetPath;
      await this.dataPersistence.saveProjectData(
        projectId,
        "config.json",
        config,
      );

      return {
        content: [
          {
            type: "text",
            text:
              `🌳 HTA Tree built successfully for "${targetPath}" path!\n\n` +
              `**Strategic Branches**: ${htaData.strategicBranches?.length || 0}\n` +
              `**Frontier Nodes**: ${htaData.frontierNodes?.length || 0}\n` +
              `**Learning Style**: ${learningStyle}\n` +
              `**Focus Areas**: ${focusAreas.join(", ") || "General exploration"}\n\n` +
              `✅ Ready to start learning with intelligent task sequencing!`,
          },
        ],
        hta_tree: htaData,
        active_path: targetPath,
      };
    } catch (/** @type {any} */ error) {
      await this.dataPersistence.logError("buildHTATree", error, {
        pathName,
        learningStyle,
        focusAreas,
      });
      return {
        content: [
          {
            type: "text",
            text: `Error building HTA tree: ${error.message}`,
          },
        ],
      };
    }
  }

  /** @param {string} projectId 
   *  @param {string} pathName */
  async loadPathHTA(projectId, pathName) {
    if (pathName === "general") {
      return await this.dataPersistence.loadProjectData(projectId, "hta.json");
    } else {
      return await this.dataPersistence.loadPathData(
        projectId,
        pathName,
        "hta.json",
      );
    }
  }

  /** @param {string} projectId 
   *  @param {string} pathName 
   *  @param {any} htaData */
  async savePathHTA(projectId, pathName, htaData) {
    if (pathName === "general") {
      return await this.dataPersistence.saveProjectData(
        projectId,
        "hta.json",
        htaData,
      );
    } else {
      return await this.dataPersistence.savePathData(
        projectId,
        pathName,
        "hta.json",
        htaData,
      );
    }
  }

  /**
   * @param {any} config
   * @param {string} pathName
   * @param {string} learningStyle
   * @param {any[]} focusAreas
   * @param {any} existingHTA
   */
  async generateHTAFramework(
    config,
    pathName,
    learningStyle,
    focusAreas,
    existingHTA,
  ) {
    const goal = config.goal;
    const knowledgeLevel = config.knowledge_level || 1;
    const interests = this.getPathInterests(config, pathName);

    // Create strategic branches (Claude-aware generateStrategicBranches)
    const strategicBranches = await this.generateStrategicBranches(
      goal,
      pathName,
      focusAreas,
      knowledgeLevel,
    );

    // Generate frontier nodes (ready-to-execute tasks)
    const frontierNodes = await this.generateSequencedFrontierNodes(
      strategicBranches,
      interests,
      learningStyle,
      knowledgeLevel,
      existingHTA,
    );

    return {
      pathName,
      goal,
      strategicBranches,
      frontierNodes,
      learningStyle,
      focusAreas,
      knowledgeLevel,
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
  }

  /** @param {any} config 
   *  @param {string} pathName */
  getPathInterests(config, pathName) {
    if (pathName === "general") {
      return config.specific_interests || [];
    }

    const path = config.learning_paths?.find((/** @type {any} */ p) => p.path_name === pathName);
    return path?.interests || config.specific_interests || [];
  }

  /** @param {string} goal 
   *  @param {string} pathName 
   *  @param {any[]} focusAreas 
   *  @param {number} knowledgeLevel */
  async generateStrategicBranches(goal, pathName, focusAreas, knowledgeLevel) {
    // Always use LLM for branch design if available
    if (this.claude && typeof this.claude.requestIntelligence === "function") {
      try {
        // Await Claude's response for branch design
        const response = await this.claude.requestIntelligence("branch-design", {
          goal,
          pathName,
          focusAreas,
          knowledgeLevel,
        });
        if (response && Array.isArray(response.branches)) {
          return response.branches;
        }
        // If Claude returns a different structure, try to extract branches
        if (response && response.data && Array.isArray(response.data.branches)) {
          return response.data.branches;
        }
      } catch (err) {
        console.error("⚠️ Claude branch-design request failed, falling back to minimal generic structure:", String(err));
        // continue to fallback below
      }
    }

    // Minimal generic fallback structure
    return [
      {
        id: "exploration",
        title: "Domain Exploration",
        priority: "high",
        completed: false,
      },
      {
        id: "fundamentals",
        title: "Core Fundamentals",
        priority: "high",
        completed: false,
      },
      {
        id: "application",
        title: "Practical Application",
        priority: "medium",
        completed: false,
      },
      {
        id: "mastery",
        title: "Advanced Mastery",
        priority: "low",
        completed: false,
      },
    ];
  }

  /**
   * @param {any[]} strategicBranches
   * @param {any[]} interests
   * @param {string} learningStyle
   * @param {number} knowledgeLevel
   * @param {any} existingHTA
   */
  async generateSequencedFrontierNodes(
    strategicBranches,
    interests,
    learningStyle,
    knowledgeLevel,
    existingHTA,
  ) {
    const frontierNodes = [];
    let nodeId = 1;

    // Extract existing completed tasks to avoid duplication
    const completedNodeIds =
      existingHTA?.frontierNodes?.filter((/** @type {any} */ n) => n.completed).map((/** @type {any} */ n) => n.id) || [];

    for (const branch of strategicBranches) {
      const branchNodes = await this.generateBranchNodes(
        branch,
        interests,
        learningStyle,
        knowledgeLevel,
        completedNodeIds,
        nodeId,
      );

      frontierNodes.push(...branchNodes);
      nodeId += branchNodes.length;
    }

    // Sort by priority and difficulty
    return this.sortNodesBySequence(frontierNodes, knowledgeLevel);
  }

  /**
   * @param {any} branch
   * @param {any[]} interests
   * @param {string} learningStyle
   * @param {number} knowledgeLevel
   * @param {Set<string>} completedTasks
   * @param {number} startNodeId
   */
  async generateBranchNodes(
    branch,
    interests,
    learningStyle,
    knowledgeLevel,
    completedTasks,
    startNodeId,
  ) {
    // Always use LLM for node creation if available
    if (this.claude && typeof this.claude.requestIntelligence === "function") {
      try {
        const response = await this.claude.requestIntelligence("branch-node-generation", {
          branch,
          interests,
          learningStyle,
          knowledgeLevel,
          completedTasks,
          startNodeId,
        });
        if (response && Array.isArray(response.nodes)) {
          return response.nodes;
        }
        if (response && response.data && Array.isArray(response.data.nodes)) {
          return response.data.nodes;
        }
      } catch (err) {
        console.error("⚠️ Claude branch-node-generation request failed, falling back to minimal generic node:", String(err));
        // continue to fallback below
      }
    }

    // Minimal generic fallback node
    return [
      {
        id: `${branch.id}_${startNodeId}`,
        title: `Explore: ${branch.title}`,
        description: `Explore the core concepts of ${branch.title}`,
        branch: branch.id,
        difficulty: 1,
        duration: "20 minutes",
        prerequisites: [],
        learningOutcome: `Basic understanding of ${branch.title}`,
        resources: [],
        completed: false,
        priority: 200,
      },
    ];
  }

  /** @param {any[]} frontierNodes 
   *  @param {number} knowledgeLevel */
  sortNodesBySequence(frontierNodes, knowledgeLevel) {
    // Sort by priority (higher first), then by difficulty (appropriate for knowledge level)
    return frontierNodes.sort((a, b) => {
      // First by priority
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Then by difficulty appropriateness
      const idealDifficulty = Math.min(knowledgeLevel + 1, 4);
      const aDiffDistance = Math.abs(a.difficulty - idealDifficulty);
      const bDiffDistance = Math.abs(b.difficulty - idealDifficulty);

      return aDiffDistance - bDiffDistance;
    });
  }
}
