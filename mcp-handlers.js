/**
 * MCP Handlers Module
 * Contains all MCP tool definitions and handler setup
 */

import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export class McpHandlers {
  constructor(server) {
    this.server = server;
  }

  setupHandlers() {
    console.error("🔧 Setting up ListToolsRequestSchema handler...");

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.error("📋 ListToolsRequestSchema handler called");

      try {
        // Define the full list once so we can also publish it through the initial
        // MCP capabilities handshake (Cursor shows 0 tools if we don't do this).
        const toolDefs = this.getToolDefinitions();
        console.error(`✓ Generated ${toolDefs.length} tool definitions`);

        // Ensure capabilities.tools exists
        if (!this.server.capabilities) {
          console.error("❌ server.capabilities is undefined, initializing...");
          this.server.capabilities = { tools: {} };
        }
        if (!this.server.capabilities.tools) {
          console.error(
            "❌ server.capabilities.tools is undefined, initializing...",
          );
          this.server.capabilities.tools = {};
        }

        // Expose tools in the handshake exactly once (before the transport
        // connects, constructor already ran `setupHandlers`).
        if (Object.keys(this.server.capabilities.tools).length === 0) {
          console.error("🔧 Setting capabilities.tools...");
          this.server.capabilities.tools = Object.fromEntries(
            toolDefs.map((t) => [t.name, t]),
          );
          console.error(
            `✓ Set ${Object.keys(this.server.capabilities.tools).length} tools in capabilities`,
          );
        } else {
          console.error(
            `✓ Capabilities already has ${Object.keys(this.server.capabilities.tools).length} tools`,
          );
        }

        console.error("✓ Returning tools list");
        return { tools: toolDefs };
      } catch (error) {
        console.error(
          "❌ Error in ListToolsRequestSchema handler:",
          error.message,
        );
        console.error("Stack:", error.stack);
        throw error;
      }
    });

    console.error("✓ ListToolsRequestSchema handler setup complete");
  }

  getToolDefinitions() {
    return [
      {
        name: "create_project",
        description:
          "Create comprehensive life orchestration project with detailed personal context",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description:
                'Unique project identifier (e.g. "dream_project_alpha")',
            },
            goal: {
              type: "string",
              description: "Ultimate ambitious goal (what you want to achieve)",
            },
            specific_interests: {
              type: "array",
              items: { type: "string" },
              description:
                'Optional: Specific things you want to be able to do (e.g. "play Let It Be on piano", "build a personal website"). Leave empty if you\'re not sure yet - the system will help you discover interests.',
            },
            learning_paths: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  path_name: {
                    type: "string",
                    description:
                      'Name of the learning path (e.g. "saxophone", "piano", "theory")',
                  },
                  interests: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific interests for this path",
                  },
                  priority: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Relative priority of this path",
                  },
                },
                required: ["path_name"],
              },
              description:
                "Optional: Define separate learning paths within your goal for isolated focus (e.g. separate piano and saxophone paths)",
            },
            context: {
              type: "string",
              description:
                "Current life situation and why this goal matters now",
            },
            constraints: {
              type: "object",
              properties: {
                time_constraints: {
                  type: "string",
                  description:
                    "Available time slots, busy periods, commitments",
                },
                energy_patterns: {
                  type: "string",
                  description:
                    "When you have high/low energy, physical limitations",
                },
                focus_variability: {
                  type: "string",
                  description:
                    'How your focus and attention vary (e.g. "consistent daily", "varies with interest", "unpredictable energy levels")',
                },
                financial_constraints: {
                  type: "string",
                  description:
                    "Budget limitations affecting learning resources",
                },
                location_constraints: {
                  type: "string",
                  description:
                    "Home setup, workspace limitations, travel requirements",
                },
              },
            },
            existing_credentials: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  credential_type: {
                    type: "string",
                    description: "Degree, certificate, course, etc.",
                  },
                  subject_area: {
                    type: "string",
                    description: "What field/subject",
                  },
                  level: {
                    type: "string",
                    description: "Beginner, intermediate, advanced, expert",
                  },
                  relevance_to_goal: {
                    type: "string",
                    description: "How this relates to your new goal",
                  },
                },
              },
              description:
                "All existing education, certificates, and relevant experience",
            },
            current_habits: {
              type: "object",
              properties: {
                good_habits: {
                  type: "array",
                  items: { type: "string" },
                  description: "Existing positive habits to maintain/build on",
                },
                bad_habits: {
                  type: "array",
                  items: { type: "string" },
                  description: "Habits you want to replace or minimize",
                },
                habit_goals: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "New habits you want to build alongside learning",
                },
              },
            },
            life_structure_preferences: {
              type: "object",
              properties: {
                wake_time: {
                  type: "string",
                  description: 'Preferred wake time (e.g. "6:00 AM")',
                },
                sleep_time: {
                  type: "string",
                  description: 'Preferred sleep time (e.g. "10:30 PM")',
                },
                meal_times: {
                  type: "array",
                  items: { type: "string" },
                  description: "Preferred meal schedule",
                },
                break_preferences: {
                  type: "string",
                  description: "How often and what type of breaks you need",
                },
                focus_duration: {
                  type: "string",
                  description:
                    'Preferred focus session length (e.g. "25 minutes", "2 hours", "until natural break", "flexible", "variable")',
                },
                transition_time: {
                  type: "string",
                  description: "Time needed between activities",
                },
              },
            },
            urgency_level: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description: "How urgently you need to achieve this goal",
            },
            success_metrics: {
              type: "array",
              items: { type: "string" },
              description:
                "How you will measure success (income, job offers, portfolio pieces, etc.)",
            },
          },
          required: ["project_id", "goal", "life_structure_preferences"],
        },
      },
      {
        name: "switch_project",
        description: "Switch to a different project workspace",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description: "Project to switch to",
            },
          },
          required: ["project_id"],
        },
      },
      {
        name: "list_projects",
        description: "Show all project workspaces",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_active_project",
        description: "Show current active project",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "build_hta_tree",
        description:
          "Build strategic HTA framework for a specific learning path",
        inputSchema: {
          type: "object",
          properties: {
            path_name: {
              type: "string",
              description:
                'Learning path to build HTA tree for (e.g. "saxophone", "piano"). If not specified, builds for active path or general project.',
            },
            learning_style: {
              type: "string",
              description:
                "Preferred learning approach (visual, hands-on, research-based, etc.)",
            },
            focus_areas: {
              type: "array",
              items: { type: "string" },
              description: "Specific areas to prioritize in the strategy",
            },
          },
        },
      },
      {
        name: "get_hta_status",
        description: "View HTA strategic framework for active project",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "generate_daily_schedule",
        description:
          "ON-DEMAND: Generate comprehensive gap-free daily schedule when requested by user",
        inputSchema: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "YYYY-MM-DD, defaults to today",
            },
            energy_level: {
              type: "number",
              minimum: 1,
              maximum: 5,
              description:
                "Current energy level (affects task difficulty and timing)",
            },
            available_hours: {
              type: "string",
              description:
                'Comma-separated list of hours to prioritize (e.g. "9,10,11,14,15")',
            },
            focus_type: {
              type: "string",
              enum: ["learning", "building", "networking", "habits", "mixed"],
              description: "Type of work to prioritize today",
            },
            schedule_request_context: {
              type: "string",
              description:
                'User context about why they need a schedule now (e.g. "planning tomorrow", "need structure today")',
            },
          },
        },
      },
      {
        name: "complete_block",
        description:
          "Complete time block and capture insights for active project",
        inputSchema: {
          type: "object",
          properties: {
            block_id: {
              type: "string",
            },
            outcome: {
              type: "string",
              description: "What happened? Key insights?",
            },
            learned: {
              type: "string",
              description: "What specific knowledge or skills did you gain?",
            },
            next_questions: {
              type: "string",
              description:
                "What questions emerged? What do you need to learn next?",
            },
            energy_level: {
              type: "number",
              minimum: 1,
              maximum: 5,
              description: "Energy after completion",
            },
            difficulty_rating: {
              type: "number",
              minimum: 1,
              maximum: 5,
              description:
                "How difficult was this task? (1=too easy, 5=too hard)",
            },
            breakthrough: {
              type: "boolean",
              description: "Major insight or breakthrough?",
            },
          },
          required: ["block_id", "outcome", "energy_level"],
        },
      },
      {
        name: "complete_with_opportunities",
        description:
          "Complete time block with rich context capture for impossible dream orchestration - use when significant breakthroughs, unexpected results, or external opportunities emerge",
        inputSchema: {
          type: "object",
          properties: {
            block_id: {
              type: "string",
              description: "The block being completed",
            },
            outcome: {
              type: "string",
              description: "What happened? Key insights?",
            },
            learned: {
              type: "string",
              description: "What specific knowledge or skills did you gain?",
            },
            energy_level: {
              type: "number",
              minimum: 1,
              maximum: 5,
              description: "Energy after completion",
            },
            engagement_level: {
              type: "number",
              minimum: 1,
              maximum: 10,
              description:
                "How deeply engaged were you? (10 = totally absorbed, lost track of time)",
            },
            unexpected_results: {
              type: "array",
              items: { type: "string" },
              description:
                "What unexpected things happened or were discovered?",
            },
            new_skills_revealed: {
              type: "array",
              items: { type: "string" },
              description:
                "What hidden talents or natural abilities did this reveal?",
            },
            external_feedback: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  source: { type: "string", description: "Who gave feedback" },
                  content: { type: "string", description: "What they said" },
                  sentiment: {
                    type: "string",
                    enum: ["positive", "negative", "neutral"],
                  },
                },
              },
              description: "Any feedback from others about your work",
            },
            social_reactions: {
              type: "array",
              items: { type: "string" },
              description:
                "Social media reactions, shares, comments, viral moments",
            },
            viral_potential: {
              type: "boolean",
              description:
                "Does this work have viral potential or unusual appeal?",
            },
            industry_connections: {
              type: "array",
              items: { type: "string" },
              description:
                "Any industry professionals who showed interest or made contact",
            },
            serendipitous_events: {
              type: "array",
              items: { type: "string" },
              description:
                "Lucky coincidences, chance meetings, unexpected opportunities",
            },
          },
          required: ["block_id", "outcome", "energy_level", "engagement_level"],
        },
      },
      {
        name: "current_status",
        description: "Show todays progress and next action for active project",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "evolve_strategy",
        description:
          "Analyze patterns and evolve the approach for active project",
        inputSchema: {
          type: "object",
          properties: {
            feedback: {
              type: "string",
              description: "What's working? What's not? What needs to change?",
            },
          },
        },
      },
      {
        name: "generate_tiimo_export",
        description: "Export today's schedule as Tiimo-compatible markdown",
        inputSchema: {
          type: "object",
          properties: {
            include_breaks: {
              type: "boolean",
              default: true,
              description: "Include break blocks between tasks",
            },
          },
        },
      },
      {
        name: "analyze_performance",
        description:
          "Analyze historical data to discover your personal productivity patterns.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "review_week",
        description:
          "Summarize the last 7 days of progress, breakthroughs, and challenges.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "review_month",
        description:
          "Provide a high-level monthly report of your progress towards the North Star.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_next_task",
        description:
          "Get the single most logical next task based on current progress and context",
        inputSchema: {
          type: "object",
          properties: {
            context_from_memory: {
              type: "string",
              description:
                "Optional context retrieved from Memory MCP about recent progress/insights",
            },
            energy_level: {
              type: "number",
              minimum: 1,
              maximum: 5,
              description:
                "Current energy level to match appropriate task difficulty",
            },
            time_available: {
              type: "string",
              description:
                'Time available for the task (e.g. "30 minutes", "1 hour")',
            },
          },
        },
      },
      {
        name: "sync_forest_memory",
        description:
          "Sync current Forest state to memory for context awareness",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "debug_task_sequence",
        description:
          "Debug task sequencing issues - shows prerequisite chains and task states",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "repair_sequence",
        description:
          "Fix broken task sequencing by rebuilding the frontier with proper dependencies",
        inputSchema: {
          type: "object",
          properties: {
            force_rebuild: {
              type: "boolean",
              description: "Completely rebuild the task sequence from scratch",
            },
          },
        },
      },
      {
        name: "focus_learning_path",
        description:
          'Set focus to a specific learning path within the project (e.g. "saxophone", "piano", "theory")',
        inputSchema: {
          type: "object",
          properties: {
            path_name: {
              type: "string",
              description:
                'Name of the learning path to focus on (e.g. "saxophone", "piano", "web development")',
            },
            duration: {
              type: "string",
              description:
                'How long to focus on this path (e.g. "today", "this week", "until next switch")',
            },
          },
          required: ["path_name"],
        },
      },
      {
        name: "analyze_complexity_evolution",
        description:
          "Analyze the current complexity tier and scaling opportunities for infinite growth potential",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "analyze_identity_transformation",
        description:
          "Analyze current identity and generate micro-shifts toward target professional identity",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_learning_paths",
        description: "Show all available learning paths in the current project",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "analyze_reasoning",
        description:
          "Generate logical deductions and strategic insights from completion patterns",
        inputSchema: {
          type: "object",
          properties: {
            include_detailed_analysis: {
              type: "boolean",
              default: true,
              description:
                "Include detailed logical chains and pattern analysis",
            },
          },
        },
      },
    ];
  }
}
