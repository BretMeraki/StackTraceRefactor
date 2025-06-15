/**
 * Task Completion Module
 * Handles task completion and learning evolution
 */

export class TaskCompletion {
  constructor(dataPersistence, projectManagement) {
    this.dataPersistence = dataPersistence;
    this.projectManagement = projectManagement;
  }

  async completeBlock(
    blockId,
    outcome,
    learned = "",
    nextQuestions = "",
    energyLevel,
    difficultyRating = 3,
    breakthrough = false,
    engagementLevel = 5,
    unexpectedResults = [],
    newSkillsRevealed = [],
    externalFeedback = [],
    socialReactions = [],
    viralPotential = false,
    industryConnections = [],
    serendipitousEvents = [],
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

      // Load today's schedule to find the block
      const today = new Date().toISOString().split("T")[0];
      const schedule =
        (await this.dataPersistence.loadProjectData(
          projectId,
          `day_${today}.json`,
        )) || {};

      const block = schedule.blocks?.find((b) => b.id === blockId);
      if (!block) {
        throw new Error(`Block ${blockId} not found in today's schedule`);
      }

      // Mark block as completed
      block.completed = true;
      block.completedAt = new Date().toISOString();
      block.outcome = outcome;
      block.learned = learned;
      block.nextQuestions = nextQuestions;
      block.energyAfter = energyLevel;
      block.difficultyRating = difficultyRating;
      block.breakthrough = breakthrough;

      // Add opportunity detection context if provided
      if (engagementLevel !== 5 || unexpectedResults.length > 0) {
        block.opportunityContext = {
          engagementLevel,
          unexpectedResults,
          newSkillsRevealed,
          externalFeedback,
          socialReactions,
          viralPotential,
          industryConnections,
          serendipitousEvents,
        };
      }

      // Save updated schedule
      await this.dataPersistence.saveProjectData(
        projectId,
        `day_${today}.json`,
        schedule,
      );

      // Update learning history
      await this.updateLearningHistory(
        projectId,
        config.activePath || "general",
        block,
      );

      // Evolve HTA tree based on learning
      if (learned || nextQuestions || breakthrough) {
        await this.evolveHTABasedOnLearning(
          projectId,
          config.activePath || "general",
          block,
        );
      }

      // Handle opportunity detection for impossible dream orchestration
      const opportunityResponse = await this.handleOpportunityDetection(
        projectId,
        block,
      );

      const responseText = this.generateCompletionResponse(
        block,
        opportunityResponse,
      );

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        block_completed: block,
        opportunity_analysis: opportunityResponse,
        next_suggested_action: this.suggestNextAction(block, schedule),
      };
    } catch (error) {
      await this.dataPersistence.logError("completeBlock", error, {
        blockId,
        outcome,
      });
      return {
        content: [
          {
            type: "text",
            text: `Error completing block: ${error.message}`,
          },
        ],
      };
    }
  }

  async updateLearningHistory(projectId, pathName, block) {
    const learningHistory = (await this.loadPathLearningHistory(
      projectId,
      pathName,
    )) || {
      completedTopics: [],
      insights: [],
      knowledgeGaps: [],
      skillProgression: {},
    };

    // Add completed topic
    learningHistory.completedTopics.push({
      topic: block.title,
      description: block.description || "",
      completedAt: block.completedAt,
      outcome: block.outcome,
      learned: block.learned,
      difficulty: block.difficultyRating,
      energyAfter: block.energyAfter,
      breakthrough: block.breakthrough,
      blockId: block.id,
      taskId: block.taskId,
    });

    // Add insights if breakthrough
    if (block.breakthrough && block.learned) {
      learningHistory.insights.push({
        insight: block.learned,
        topic: block.title,
        timestamp: block.completedAt,
        context: block.outcome,
      });
    }

    // Add knowledge gaps from next questions
    if (block.nextQuestions) {
      const questions = block.nextQuestions
        .split(".")
        .filter((q) => q.trim().length > 0);
      for (const question of questions) {
        learningHistory.knowledgeGaps.push({
          question: question.trim(),
          relatedTopic: block.title,
          identified: block.completedAt,
          priority: block.breakthrough ? "high" : "medium",
        });
      }
    }

    // Update skill progression
    if (block.branch) {
      if (!learningHistory.skillProgression[block.branch]) {
        learningHistory.skillProgression[block.branch] = {
          level: 1,
          completedTasks: 0,
          totalEngagement: 0,
        };
      }

      const progression = learningHistory.skillProgression[block.branch];
      progression.completedTasks += 1;
      progression.totalEngagement +=
        block.opportunityContext?.engagementLevel || 5;
      progression.level = Math.min(
        10,
        1 + Math.floor(progression.completedTasks / 3),
      );
    }

    await this.savePathLearningHistory(projectId, pathName, learningHistory);
  }

  async evolveHTABasedOnLearning(projectId, pathName, block) {
    const htaData = await this.loadPathHTA(projectId, pathName);
    if (!htaData) return;

    // Mark corresponding HTA node as completed
    if (block.taskId) {
      const node = htaData.frontierNodes?.find((n) => n.id === block.taskId);
      if (node) {
        node.completed = true;
        node.completedAt = block.completedAt;
        node.actualDifficulty = block.difficultyRating;
        node.actualDuration = block.duration;
      }
    }

    // Generate follow-up tasks based on learning and questions
    if (block.nextQuestions || block.breakthrough) {
      const newTasks = this.generateFollowUpTasks(block, htaData);
      if (newTasks.length > 0) {
        htaData.frontierNodes = (htaData.frontierNodes || []).concat(newTasks);
      }
    }

    // Handle opportunity-driven task generation
    if (block.opportunityContext) {
      const opportunityTasks = this.generateOpportunityTasks(block, htaData);
      if (opportunityTasks.length > 0) {
        htaData.frontierNodes = (htaData.frontierNodes || []).concat(
          opportunityTasks,
        );
      }
    }

    htaData.lastUpdated = new Date().toISOString();
    await this.savePathHTA(projectId, pathName, htaData);
  }

  generateFollowUpTasks(block, htaData) {
    const newTasks = [];
    let taskId = (htaData.frontierNodes?.length || 0) + 1000;

    // Generate tasks from next questions
    if (block.nextQuestions) {
      const questions = block.nextQuestions
        .split(".")
        .filter((q) => q.trim().length > 0);

      for (const question of questions.slice(0, 2)) {
        // Limit to 2 follow-up tasks
        newTasks.push({
          id: `followup_${taskId++}`,
          title: `Explore: ${question.trim()}`,
          description: `Investigation stemming from ${block.title}`,
          branch: block.branch || "exploration",
          difficulty: Math.max(1, (block.difficultyRating || 3) - 1),
          duration: "20 minutes",
          prerequisites: [block.taskId].filter(Boolean),
          learningOutcome: `Understanding of ${question.trim()}`,
          priority: block.breakthrough ? 250 : 200,
          generated: true,
          sourceBlock: block.id,
        });
      }
    }

    return newTasks;
  }

  generateOpportunityTasks(block, htaData) {
    const opportunityTasks = [];
    const context = block.opportunityContext;
    let taskId = (htaData.frontierNodes?.length || 0) + 2000;

    // High engagement detection - indicates natural talent/interest
    if (context.engagementLevel >= 8) {
      opportunityTasks.push({
        id: `breakthrough_${taskId++}`,
        title: `Amplify: ${block.title} Success`,
        description: `Build on the breakthrough momentum from ${block.title}`,
        branch: block.branch || "opportunity",
        difficulty: Math.min(5, (block.difficultyRating || 3) + 1),
        duration: "45 minutes",
        prerequisites: [block.taskId].filter(Boolean),
        learningOutcome: "Amplified skills and deeper mastery",
        priority: 350, // High priority for breakthrough amplification
        opportunityType: "breakthrough_amplification",
      });
    }

    // External feedback opportunities
    if (context.externalFeedback?.length > 0) {
      const positiveFeedback = context.externalFeedback.filter(
        (f) => f.sentiment === "positive",
      );
      if (positiveFeedback.length > 0) {
        opportunityTasks.push({
          id: `network_${taskId++}`,
          title: `Follow Up: External Interest`,
          description: `Connect with people who showed interest in your ${block.title} work`,
          branch: "networking",
          difficulty: 2,
          duration: "30 minutes",
          learningOutcome: "Professional connections and feedback",
          priority: 300,
          opportunityType: "networking",
        });
      }
    }

    // Viral potential tasks
    if (context.viralPotential) {
      opportunityTasks.push({
        id: `viral_${taskId++}`,
        title: `Leverage: Viral Momentum`,
        description: `Capitalize on the viral potential of your ${block.title} work`,
        branch: "marketing",
        difficulty: 3,
        duration: "60 minutes",
        learningOutcome: "Understanding of viral content and audience building",
        priority: 320,
        opportunityType: "viral_leverage",
      });
    }

    return opportunityTasks;
  }

  async handleOpportunityDetection(projectId, block) {
    const context = block.opportunityContext;
    if (!context) return null;

    const opportunities = [];

    // Analyze engagement levels
    if (context.engagementLevel >= 8) {
      opportunities.push({
        type: "natural_talent_indicator",
        message: `🌟 High engagement detected (${context.engagementLevel}/10)! This suggests natural aptitude.`,
        action:
          "Consider doubling down on this area and exploring advanced techniques.",
      });
    }

    // Analyze unexpected results
    if (context.unexpectedResults?.length > 0) {
      opportunities.push({
        type: "serendipitous_discovery",
        message: `🔍 Unexpected discoveries: ${context.unexpectedResults.join(", ")}`,
        action:
          "These discoveries could open new pathways - explore them further.",
      });
    }

    // Analyze external feedback
    if (context.externalFeedback?.length > 0) {
      const positiveCount = context.externalFeedback.filter(
        (f) => f.sentiment === "positive",
      ).length;
      if (positiveCount > 0) {
        opportunities.push({
          type: "external_validation",
          message: `👥 Received ${positiveCount} positive feedback responses`,
          action:
            "This external validation suggests market potential - consider networking.",
        });
      }
    }

    // Analyze viral potential
    if (context.viralPotential) {
      opportunities.push({
        type: "viral_potential",
        message: `🚀 Content has viral potential detected`,
        action:
          "Create more content in this style and engage with the audience.",
      });
    }

    return {
      detected: opportunities.length > 0,
      opportunities,
      recommendedPath: this.recommendOpportunityPath(opportunities),
    };
  }

  recommendOpportunityPath(opportunities) {
    if (opportunities.length === 0) return "continue_planned_path";

    const types = opportunities.map((o) => o.type);

    if (
      types.includes("viral_potential") &&
      types.includes("external_validation")
    ) {
      return "accelerated_professional_path";
    } else if (
      types.includes("natural_talent_indicator") &&
      types.includes("serendipitous_discovery")
    ) {
      return "exploration_amplification_path";
    } else if (types.includes("external_validation")) {
      return "networking_focus_path";
    } else {
      return "breakthrough_deepening_path";
    }
  }

  generateCompletionResponse(block, opportunityResponse) {
    let response = `✅ **Block Completed**: ${block.title}\n\n`;
    response += `**Outcome**: ${block.outcome}\n`;

    if (block.learned) {
      response += `**Learned**: ${block.learned}\n`;
    }

    response += `**Energy After**: ${block.energyAfter}/5\n`;
    response += `**Difficulty**: ${block.difficultyRating}/5\n`;

    if (block.breakthrough) {
      response += `\n🎉 **BREAKTHROUGH DETECTED!** 🎉\n`;
    }

    if (opportunityResponse?.detected) {
      response += `\n🌟 **OPPORTUNITY ANALYSIS**:\n`;
      for (const opp of opportunityResponse.opportunities) {
        response += `• ${opp.message}\n`;
        response += `  💡 ${opp.action}\n`;
      }

      const pathRecommendation = this.getPathRecommendationText(
        opportunityResponse.recommendedPath,
      );
      response += `\n🎯 **Recommended Path**: ${pathRecommendation}\n`;
    }

    if (block.nextQuestions) {
      response += `\n❓ **Next Questions**: ${block.nextQuestions}\n`;
    }

    return response;
  }

  getPathRecommendationText(pathType) {
    const paths = {
      accelerated_professional_path:
        "Focus on professional networking and content creation",
      exploration_amplification_path:
        "Deep dive into discovered talents and interests",
      networking_focus_path: "Prioritize building professional connections",
      breakthrough_deepening_path: "Deepen mastery in breakthrough areas",
      continue_planned_path: "Continue with planned learning sequence",
    };

    return paths[pathType] || "Continue planned learning";
  }

  suggestNextAction(block, schedule) {
    const remainingBlocks = schedule.blocks?.filter((b) => !b.completed) || [];

    if (remainingBlocks.length > 0) {
      const nextBlock = remainingBlocks[0];
      return {
        type: "continue_schedule",
        message: `Next: ${nextBlock.title} at ${nextBlock.startTime}`,
        blockId: nextBlock.id,
      };
    } else {
      return {
        type: "day_complete",
        message:
          "All blocks completed! Consider reviewing progress or planning tomorrow.",
        suggestion:
          "Use analyze_reasoning to extract insights from today's learning",
      };
    }
  }

  async loadPathLearningHistory(projectId, pathName) {
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

  async savePathLearningHistory(projectId, pathName, learningHistory) {
    if (pathName === "general") {
      return await this.dataPersistence.saveProjectData(
        projectId,
        "learning_history.json",
        learningHistory,
      );
    } else {
      return await this.dataPersistence.savePathData(
        projectId,
        pathName,
        "learning_history.json",
        learningHistory,
      );
    }
  }

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
}
