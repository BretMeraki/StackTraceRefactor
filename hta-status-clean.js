/**
 * HTA Status Module - CLEAN VERSION
 * Handles HTA tree status reporting and metadata - NO HARDCODED RESPONSES
 */

export class HtaStatus {
  constructor(dataPersistence, projectManagement) {
    this.dataPersistence = dataPersistence;
    this.projectManagement = projectManagement;
  }

  async getHTAStatus() {
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
      const htaData = await this.loadPathHTA(projectId, activePath);

      if (!htaData) {
        return {
          content: [
            {
              type: "text",
              text: `❌ No HTA tree found for "${activePath}" path. Use \`build_hta_tree\` first.`,
            },
          ],
        };
      }

      const statusReport = this.generateStatusReport(htaData, activePath);

      return {
        content: [
          {
            type: "text",
            text: statusReport,
          },
        ],
        hta_status: {
          path: activePath,
          strategic_branches:
            htaData.branches || htaData.strategicBranches || [],
          frontier_nodes: htaData.frontier_nodes || htaData.frontierNodes || [],
          progress: this.calculateProgress(htaData),
          last_updated: htaData.last_evolution || htaData.lastUpdated,
        },
      };
    } catch (error) {
      await this.dataPersistence.logError("getHTAStatus", error);
      return {
        content: [
          {
            type: "text",
            text: `Error getting HTA status: ${error.message}`,
          },
        ],
      };
    }
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

      const projectHTA = await this.dataPersistence.loadProjectData(
        projectId,
        "hta.json",
      );
      return projectHTA;
    } else {
      return await this.dataPersistence.loadPathData(
        projectId,
        pathName,
        "hta.json",
      );
    }
  }

  generateStatusReport(htaData, pathName) {
    // Handle both naming conventions
    const branches = htaData.branches || htaData.strategicBranches || [];
    const nodes = htaData.frontier_nodes || htaData.frontierNodes || [];
    const completedNodes = htaData.completed_nodes || [];

    // Merge completed and frontier nodes for full task list
    const allNodes = [...nodes, ...completedNodes];
    const progress = this.calculateProgress({
      ...htaData,
      frontier_nodes: allNodes,
    });

    let report = `🌳 **HTA Tree Status - ${pathName} Path**\n\n`;
    report += `**Goal**: ${htaData.north_star || htaData.goal || "Not specified"}\n`;
    report += `**Progress**: ${progress.percentage}% (${progress.completed}/${progress.total} tasks)\n`;
    report += `**Learning Style**: ${htaData.learning_style || htaData.learningStyle || "mixed"}\n\n`;

    // Strategic Branches Status
    report += `📊 **Strategic Branches** (${branches.length}):\n`;
    for (const branch of branches) {
      const branchNodes = nodes.filter((n) => n.branch === branch.id);
      const completedBranchNodes = branchNodes.filter((n) => n.completed);
      const branchProgress =
        branchNodes.length > 0
          ? Math.round((completedBranchNodes.length / branchNodes.length) * 100)
          : 0;

      const status = branch.completed ? "✅" : branchProgress > 0 ? "🔄" : "⏳";
      report += `${status} **${branch.title}** - ${branchProgress}% (${completedBranchNodes.length}/${branchNodes.length})\n`;
    }

    // Ready Tasks - only from frontier_nodes, not completed
    const readyNodes = this.getReadyNodes(nodes);
    report += `\n🎯 **Ready Tasks** (${readyNodes.length}):\n`;

    if (readyNodes.length === 0) {
      report += "• No tasks ready - check prerequisites or build new tasks\n";
    } else {
      for (const node of readyNodes.slice(0, 5)) {
        // Show top 5
        const difficultyStars = "⭐".repeat(node.difficulty || 1);
        report += `• **${node.title}** ${difficultyStars} (${node.duration || "30 min"})\n`;
      }

      if (readyNodes.length > 5) {
        report += `• ... and ${readyNodes.length - 5} more tasks\n`;
      }
    }

    // Show completed tasks if any
    if (completedNodes.length > 0) {
      report += `\n✅ **Completed Tasks** (${completedNodes.length}):\n`;
      for (const node of completedNodes) {
        report += `• ${node.title}\n`;
      }
    }

    // Next Actions
    report += `\n🚀 **Next Actions**:\n`;
    if (readyNodes.length > 0) {
      report += `• Use \`get_next_task\` to get the optimal next task\n`;
      report += `• Use \`generate_daily_schedule\` for comprehensive planning\n`;
    } else {
      report += `• Use \`evolve_strategy\` to generate new tasks\n`;
      report += `• Use \`build_hta_tree\` to rebuild the learning path\n`;
    }

    return report;
  }

  calculateProgress(htaData) {
    const frontierNodes = htaData.frontier_nodes || htaData.frontierNodes || [];
    const completedNodes = htaData.completed_nodes || [];
    const completed =
      completedNodes.length + frontierNodes.filter((n) => n.completed).length;
    const total = frontierNodes.length + completedNodes.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      completed,
      total,
      percentage,
    };
  }

  getReadyNodes(nodes) {
    const completedNodeIds = nodes.filter((n) => n.completed).map((n) => n.id);

    return nodes.filter((node) => {
      if (node.completed) return false;

      // Check if all prerequisites are met
      if (node.prerequisites && node.prerequisites.length > 0) {
        return node.prerequisites.every(
          (prereq) =>
            completedNodeIds.includes(prereq) ||
            nodes.some((n) => n.title === prereq && n.completed),
        );
      }

      return true; // No prerequisites, so it's ready
    });
  }
}
