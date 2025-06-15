/**
 * Task Intelligence Module
 * Handles smart task generation and strategy evolution
 */

export class TaskIntelligence {
  /**
   * @param {any} dataPersistence
   * @param {any} projectManagement
   * @param {any} [claudeInterface]
   */
  constructor(dataPersistence, projectManagement, claudeInterface = null) {
    this.dataPersistence = dataPersistence;
    this.projectManagement = projectManagement;
    this.claude = claudeInterface;
  }

  async getNextTask(
    contextFromMemory = "",
    energyLevel = 3,
    timeAvailable = "30 minutes",
  ) {
    // 1️⃣ Ask Claude for the optimal task if interface is available
    if (this.claude && typeof this.claude.requestIntelligence === "function") {
      try {
        return await this.claude.requestIntelligence("next-task-selection", {
          contextFromMemory,
          energyLevel,
          timeAvailable,
        });
      } catch (/** @type {any} */ err) {
        console.error("⚠️ Claude next-task-selection failed, falling back to static placeholder:", err?.message || err);
      }
    }

    // Legacy placeholder (will be removed when Claude path is stable)
    return {
      content: [
        {
          type: "text",
          text: `⏳ Claude unavailable – no intelligent task yet.`,
        },
      ],
      selected_task: null,
    };
  }

  async evolveStrategy(feedback = "") {
    try {
      const projectId = await this.projectManagement.requireActiveProject();
      const config = await this.dataPersistence.loadProjectData(
        projectId,
        "config.json",
      );

      if (!config) {
        throw new Error("Project configuration not found");
      }

      const activePath = config.activePath || "general";
      const analysis = await this.analyzeCurrentStrategy(
        projectId,
        activePath,
        feedback,
      );
      const newTasks = await this.generateSmartNextTasks(
        projectId,
        activePath,
        analysis,
      );

      // Update HTA tree with new tasks
      if (newTasks.length > 0) {
        const htaData = (await this.loadPathHTA(projectId, activePath)) || {};
        htaData.frontier_nodes = (htaData.frontier_nodes || []).concat(
          newTasks,
        );
        htaData.last_evolution = new Date().toISOString();
        await this.savePathHTA(projectId, activePath, htaData);
      }

      const responseText = this.formatStrategyEvolutionResponse(
        analysis,
        newTasks,
        feedback,
      );

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        strategy_analysis: analysis,
        new_tasks: newTasks,
        feedback_processed: feedback || "none",
      };
    } catch (error) {
      await this.dataPersistence.logError("evolveStrategy", error, {
        feedback,
      });
      return {
        content: [
          {
            type: "text",
            text: `Error evolving strategy: ${error.message}`,
          },
        ],
      };
    }
  }

  selectOptimalTask(htaData, energyLevel, timeAvailable, contextFromMemory) {
    const nodes = htaData.frontier_nodes || [];
    const completedNodeIds = nodes.filter((n) => n.completed).map((n) => n.id);

    // Filter available tasks (not completed, prerequisites met)
    const availableTasks = nodes.filter((node) => {
      if (node.completed) return false;

      if (node.prerequisites && node.prerequisites.length > 0) {
        return node.prerequisites.every(
          (prereq) =>
            completedNodeIds.includes(prereq) ||
            nodes.some((n) => n.title === prereq && n.completed),
        );
      }

      return true;
    });

    if (availableTasks.length === 0) return null;

    // Parse time available
    const timeInMinutes = this.parseTimeToMinutes(timeAvailable);

    // Score tasks based on multiple factors
    const scoredTasks = availableTasks.map((task) => ({
      ...task,
      score: this.calculateTaskScore(
        task,
        energyLevel,
        timeInMinutes,
        contextFromMemory,
      ),
    }));

    // Sort by score (highest first)
    scoredTasks.sort((a, b) => b.score - a.score);

    return scoredTasks[0];
  }

  calculateTaskScore(task, energyLevel, timeInMinutes, contextFromMemory) {
    let score = task.priority || 200;

    // Energy level matching
    const taskDifficulty = task.difficulty || 3;
    const energyMatch = 5 - Math.abs(energyLevel - taskDifficulty);
    score += energyMatch * 20;

    // Time matching
    const taskDuration = this.parseTimeToMinutes(task.duration || "30 minutes");
    const timeMatch = timeInMinutes >= taskDuration ? 30 : -50;
    score += timeMatch;

    // Context relevance
    if (contextFromMemory && this.isContextRelevant(task, contextFromMemory)) {
      score += 50;
    }

    // Breakthrough potential
    if (task.opportunityType === "breakthrough_amplification") {
      score += 100;
    }

    // Recently generated tasks get boost
    if (task.generated) {
      score += 25;
    }

    return score;
  }

  isContextRelevant(task, context) {
    const taskText = (task.title + " " + task.description).toLowerCase();
    const contextLower = context.toLowerCase();

    // Simple keyword matching - could be enhanced with NLP
    const keywords = contextLower.split(" ").filter((word) => word.length > 3);
    return keywords.some((keyword) => taskText.includes(keyword));
  }

  async analyzeCurrentStrategy(projectId, pathName, feedback) {
    const htaData = (await this.loadPathHTA(projectId, pathName)) || {};
    const learningHistory =
      (await this.loadLearningHistory(projectId, pathName)) || {};

    const analysis = {
      completedTasks:
        htaData.frontier_nodes?.filter((n) => n.completed).length || 0,
      totalTasks: htaData.frontier_nodes?.length || 0,
      availableTasks: this.getAvailableTasksCount(htaData),
      stuckIndicators: this.detectStuckIndicators(htaData, learningHistory),
      userFeedback: this.analyzeFeedback(feedback),
      recommendedEvolution: null,
    };

    // Determine evolution strategy
    analysis.recommendedEvolution = this.determineEvolutionStrategy(analysis);

    return analysis;
  }

  getAvailableTasksCount(htaData) {
    const nodes = htaData.frontier_nodes || [];
    const completedNodeIds = nodes.filter((n) => n.completed).map((n) => n.id);

    return nodes.filter((node) => {
      if (node.completed) return false;

      if (node.prerequisites && node.prerequisites.length > 0) {
        return node.prerequisites.every(
          (prereq) =>
            completedNodeIds.includes(prereq) ||
            nodes.some((n) => n.title === prereq && n.completed),
        );
      }

      return true;
    }).length;
  }

  detectStuckIndicators(htaData, learningHistory) {
    const indicators = [];

    // No available tasks
    if (this.getAvailableTasksCount(htaData) === 0) {
      indicators.push("no_available_tasks");
    }

    // No recent completions
    const recentCompletions =
      learningHistory.completedTopics?.filter((t) => {
        const daysDiff =
          (Date.now() - new Date(t.completedAt)) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      }) || [];

    if (recentCompletions.length === 0) {
      indicators.push("no_recent_progress");
    }

    // Low engagement
    const avgEngagement =
      recentCompletions.reduce((sum, c) => sum + (c.energyAfter || 3), 0) /
      Math.max(recentCompletions.length, 1);
    if (avgEngagement < 2.5) {
      indicators.push("low_engagement");
    }

    return indicators;
  }

  analyzeFeedback(feedback) {
    if (!feedback) return { sentiment: "neutral", keywords: [] };

    const feedbackLower = feedback.toLowerCase();

    let sentiment = "neutral";
    if (
      feedbackLower.includes("boring") ||
      feedbackLower.includes("stuck") ||
      feedbackLower.includes("difficult")
    ) {
      sentiment = "negative";
    } else if (
      feedbackLower.includes("great") ||
      feedbackLower.includes("interesting") ||
      feedbackLower.includes("progress")
    ) {
      sentiment = "positive";
    }

    const keywords = feedback.split(" ").filter((word) => word.length > 3);

    return { sentiment, keywords, original: feedback };
  }

  determineEvolutionStrategy(analysis) {
    if (analysis.stuckIndicators.includes("no_available_tasks")) {
      return "generate_new_tasks";
    }

    if (analysis.stuckIndicators.includes("low_engagement")) {
      return "increase_variety_and_interest";
    }

    if (analysis.userFeedback.sentiment === "negative") {
      return "address_user_concerns";
    }

    if (analysis.availableTasks < 3) {
      return "expand_task_frontier";
    }

    return "optimize_existing_sequence";
  }

  async generateSmartNextTasks(projectId, pathName, analysis) {
    const config = await this.dataPersistence.loadProjectData(
      projectId,
      "config.json",
    );
    const htaData = (await this.loadPathHTA(projectId, pathName)) || {};

    // Always use LLM for task generation if available
    if (this.claude && typeof this.claude.requestIntelligence === "function") {
      try {
        const response = await this.claude.requestIntelligence("task-generation", {
          config,
          htaData,
          analysis,
          projectId,
          pathName,
        });
        if (response && Array.isArray(response.tasks)) {
          return response.tasks;
        }
        if (response && response.data && Array.isArray(response.data.tasks)) {
          return response.data.tasks;
        }
      } catch (err) {
        console.error("⚠️ Claude task-generation request failed, falling back to minimal generic structure:", String(err));
        // continue to fallback below
      }
    }

    // Minimal generic fallback structure
    return [
      {
        id: `explore_fallback_${Date.now()}`,
        title: "Explore: New Possibility",
        description: "Discover new aspects of your learning domain",
        difficulty: 1,
        duration: "20 minutes",
        branch: "exploration",
        priority: 230,
        generated: true,
      },
      {
        id: `practice_fallback_${Date.now() + 1}`,
        title: "Practice: Core Skill",
        description: "Reinforce fundamental skills",
        difficulty: 3,
        duration: "30 minutes",
        branch: "practice",
        priority: 220,
        generated: true,
      },
    ];
  }

  formatTaskResponse(task, energyLevel, timeAvailable) {
    const difficultyStars = "⭐".repeat(task.difficulty || 1);
    const duration = task.duration || "30 minutes";

    let response = `🎯 **Next Recommended Task**\n\n`;
    response += `**${task.title}**\n`;
    response += `${task.description || "No description available"}\n\n`;
    response += `⏱️ **Duration**: ${duration}\n`;
    response += `${difficultyStars} **Difficulty**: ${task.difficulty || 1}/5\n`;
    response += `🎯 **Branch**: ${task.branch || "general"}\n`;

    if (task.learningOutcome) {
      response += `📈 **Learning Outcome**: ${task.learningOutcome}\n`;
    }

    response += `\n⚡ **Energy Match**: ${this.getEnergyMatchText(task.difficulty || 3, energyLevel)}\n`;
    response += `⏰ **Time Match**: ${this.getTimeMatchText(duration, timeAvailable)}\n`;

    response += `\n✅ Use \`complete_block\` with block_id: "${task.id}" when finished`;

    return response;
  }

  getEnergyMatchText(taskDifficulty, energyLevel) {
    const diff = Math.abs(taskDifficulty - energyLevel);
    if (diff <= 1) return "Excellent match";
    if (diff <= 2) return "Good match";
    return "Consider adjusting energy or task difficulty";
  }

  getTimeMatchText(taskDuration, timeAvailable) {
    const taskMinutes = this.parseTimeToMinutes(taskDuration);
    const availableMinutes = this.parseTimeToMinutes(timeAvailable);

    if (taskMinutes <= availableMinutes) return "Perfect fit";
    if (taskMinutes <= availableMinutes * 1.2) return "Close fit";
    return "May need more time";
  }

  formatStrategyEvolutionResponse(analysis, newTasks, feedback) {
    let response = `🧠 **Strategy Evolution Complete**\n\n`;

    response += `📊 **Current Status**:\n`;
    response += `• Completed tasks: ${analysis.completedTasks}/${analysis.totalTasks}\n`;
    response += `• Available tasks: ${analysis.availableTasks}\n`;

    if (analysis.stuckIndicators.length > 0) {
      response += `• Detected issues: ${analysis.stuckIndicators.join(", ")}\n`;
    }

    response += `\n🎯 **Evolution Strategy**: ${analysis.recommendedEvolution.replace(/_/g, " ")}\n`;

    if (newTasks.length > 0) {
      response += `\n✨ **New Tasks Generated** (${newTasks.length}):\n`;
      for (const task of newTasks.slice(0, 3)) {
        response += `• ${task.title} (${task.duration || "30 min"})\n`;
      }

      if (newTasks.length > 3) {
        response += `• ... and ${newTasks.length - 3} more\n`;
      }
    }

    if (feedback) {
      response += `\n💬 **Feedback Processed**: ${analysis.userFeedback.sentiment} sentiment detected\n`;
    }

    response += `\n🚀 **Next Step**: Use \`get_next_task\` to get your optimal next task`;

    return response;
  }

  parseTimeToMinutes(timeStr) {
    const matches = timeStr.match(/(\d+)\s*(minute|hour|min|hr)/i);
    if (!matches) return 30;

    const value = parseInt(matches[1]);
    const unit = matches[2].toLowerCase();

    return unit.startsWith("hour") || unit.startsWith("hr")
      ? value * 60
      : value;
  }

  async loadPathHTA(projectId, pathName) {
    if (pathName === "general") {
      // Try path-specific HTA first, fallback to project-level
      const pathHTA = await this.dataPersistence.loadPathData(
        projectId,
        pathName,
        "hta.json",
      );
      if (pathHTA) return pathHTA;
      return await this.dataPersistence.loadProjectData(projectId, "hta.json");
    } else {
      return await this.dataPersistence.loadPathData(
        projectId,
        pathName,
        "hta.json",
      );
    }
  }

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

  async loadLearningHistory(projectId, pathName) {
    if (pathName === "general") {
      return await this.dataPersistence.loadProjectData(
        projectId,
        "learning_history.json",
      );
    } else {
      return await this.dataPersistence.loadPathData(
        projectId,
        pathName,
        "learning_history.json",
      );
    }
  }
}
