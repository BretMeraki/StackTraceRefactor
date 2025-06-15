/**
 * Tool Router Module
 * Handles MCP tool request routing and execution
 */

import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export class ToolRouter {
  constructor(server, forestServer) {
    this.server = server;
    this.forestServer = forestServer;
  }

  setupRouter() {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case "create_project":
            return await this.forestServer.createProject(args);
          case "switch_project":
            return await this.forestServer.switchProject(args.project_id);
          case "list_projects":
            return await this.forestServer.listProjects();
          case "get_active_project":
            return await this.forestServer.getActiveProject();
          case "build_hta_tree":
            return await this.forestServer.buildHTATree(
              args.path_name,
              args.learning_style || "mixed",
              args.focus_areas || [],
            );
          case "get_hta_status":
            return await this.forestServer.getHTAStatus();
          case "generate_daily_schedule":
            return await this.forestServer.generateDailySchedule(
              args.date || null,
              args.energy_level ?? 3,
              args.available_hours || null,
              args.focus_type || "mixed",
              args.schedule_request_context || "User requested schedule",
            );
          case "complete_block":
            return await this.forestServer.completeBlock(
              args.block_id,
              args.outcome,
              args.learned || "",
              args.next_questions || "",
              args.energy_level,
              args.difficulty_rating || 3,
              args.breakthrough || false,
            );
          case "complete_with_opportunities":
            return await this.forestServer.completeBlock(
              args.block_id,
              args.outcome,
              args.learned || "",
              args.next_questions || "",
              args.energy_level,
              args.difficulty_rating || 3,
              args.breakthrough || false,
              // OPPORTUNITY DETECTION CONTEXT
              args.engagement_level || 5,
              args.unexpected_results || [],
              args.new_skills_revealed || [],
              args.external_feedback || [],
              args.social_reactions || [],
              args.viral_potential || false,
              args.industry_connections || [],
              args.serendipitous_events || [],
            );
          case "get_next_task":
            return await this.forestServer.getNextTask(
              args.context_from_memory || "",
              args.energy_level || 3,
              args.time_available || "30 minutes",
            );
          case "current_status":
            return await this.forestServer.currentStatus();
          case "evolve_strategy":
            return await this.forestServer.evolveStrategy(args.feedback || "");
          case "generate_tiimo_export":
            return await this.forestServer.generateTiimoExport(
              args.include_breaks ?? true,
            );
          case "analyze_performance":
            return await this.forestServer.analyzePerformance();
          case "review_week":
            return await this.forestServer.reviewPeriod(7);
          case "review_month":
            return await this.forestServer.reviewPeriod(30);
          case "sync_forest_memory":
            return await this.forestServer.syncForestMemory();
          case "debug_task_sequence":
            return await this.forestServer.debugTaskSequence();
          case "repair_sequence":
            return await this.forestServer.repairSequence(
              args.force_rebuild || false,
            );
          case "focus_learning_path":
            return await this.forestServer.focusLearningPath(
              args.path_name,
              args.duration || "until next switch",
            );
          case "list_learning_paths":
            return await this.forestServer.listLearningPaths();
          case "analyze_complexity_evolution":
            return await this.forestServer.analyzeComplexityEvolution();
          case "analyze_identity_transformation":
            return await this.forestServer.analyzeIdentityTransformation();
          case "analyze_reasoning":
            return await this.forestServer.analyzeReasoning(
              args.include_detailed_analysis ?? true,
            );
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }
}
