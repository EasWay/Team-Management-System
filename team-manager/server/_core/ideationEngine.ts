import { invokeLLM } from "./llm";

export interface Speaker {
  name: string;
  role: string;
  contributions: number;
}

export interface IdeationAnalysis {
  speakers: Speaker[];
  businessGoals: string[];
  designNeeds: string[];
  technicalSpecs: string[];
  targetAudience: string;
  keyFeatures: string[];
  successMetrics: string[];
}

export interface FinalDecisionReport {
  projectName: string;
  executiveSummary: string;
  businessRequirements: {
    goals: string[];
    targetMarket: string;
    revenueModel: string;
    competitiveAdvantage: string;
  };
  designRequirements: {
    userExperience: string[];
    visualStyle: string;
    accessibility: string[];
    platforms: string[];
  };
  technicalRequirements: {
    architecture: string;
    technologies: string[];
    integrations: string[];
    scalability: string;
    security: string[];
  };
  timeline: {
    estimatedDuration: string;
    phases: Array<{ name: string; duration: string; deliverables: string[] }>;
  };
  risks: Array<{ risk: string; mitigation: string }>;
  nextSteps: string[];
}

export interface IdeationResult {
  chatLogs: string;
  speakers: Speaker[];
  aiAnalysis: IdeationAnalysis;
  finalDecisionReport: FinalDecisionReport;
}

/**
 * Identify speakers from chat logs
 * Supports WhatsApp, Slack, Discord, and generic chat formats
 */
export async function identifySpeakers(chatLogs: string): Promise<Speaker[]> {
  const prompt = `
Analyze the following chat conversation and identify all unique speakers/participants.
For each speaker, extract:
1. Their name (as it appears in the chat)
2. Their likely role based on their contributions (e.g., CEO, Designer, Developer, Business Analyst, Product Manager, etc.)
3. Number of meaningful contributions they made

Chat formats to support:
- WhatsApp: "[Date, Time] Name: Message"
- Slack: "Name [Time]: Message"
- Discord: "Name - Today at Time: Message"
- Generic: "Name: Message"

Return a JSON array of speakers.

Expected JSON structure:
{
  "speakers": [
    {
      "name": "John Doe",
      "role": "CEO",
      "contributions": 15
    }
  ]
}

Rules:
- Identify roles based on conversation context (who talks about business strategy, design, technical implementation, etc.)
- Count only meaningful contributions (ignore "ok", "thanks", etc.)
- If role is unclear, use "Team Member"

Chat Logs:
"""
${chatLogs}
"""
`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert at analyzing team conversations and identifying participants and their roles." },
        { role: "user", content: prompt }
      ],
      responseFormat: { type: "json_object" }
    });

    const content = typeof result.choices[0].message.content === 'string'
      ? result.choices[0].message.content
      : JSON.stringify(result.choices[0].message.content);

    const parsed = JSON.parse(content);
    return parsed.speakers || [];
  } catch (error) {
    console.error("[Ideation Engine] Failed to identify speakers:", error);
    throw new Error("Failed to identify speakers from chat logs.");
  }
}

/**
 * Analyze chat logs to extract comprehensive requirements
 */
export async function analyzeIdeation(chatLogs: string, speakers: Speaker[]): Promise<IdeationAnalysis> {
  const speakerContext = speakers.map(s => `${s.name} (${s.role})`).join(", ");

  const prompt = `
Analyze the following team conversation about a new project idea.

Participants: ${speakerContext}

Extract and organize the following information:

1. Business Goals - What business objectives are they trying to achieve?
2. Design Needs - What user experience, visual, or design requirements were mentioned?
3. Technical Specs - What technical requirements, technologies, or architecture were discussed?
4. Target Audience - Who is this product/service for?
5. Key Features - What are the main features or capabilities?
6. Success Metrics - How will they measure success?

Return comprehensive, actionable information in JSON format.

Expected JSON structure:
{
  "businessGoals": ["Goal 1", "Goal 2"],
  "designNeeds": ["Need 1", "Need 2"],
  "technicalSpecs": ["Spec 1", "Spec 2"],
  "targetAudience": "Description of target users",
  "keyFeatures": ["Feature 1", "Feature 2"],
  "successMetrics": ["Metric 1", "Metric 2"]
}

Chat Logs:
"""
${chatLogs}
"""
`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert business analyst and product strategist who excels at extracting structured requirements from conversations." },
        { role: "user", content: prompt }
      ],
      responseFormat: { type: "json_object" }
    });

    const content = typeof result.choices[0].message.content === 'string'
      ? result.choices[0].message.content
      : JSON.stringify(result.choices[0].message.content);

    const parsed = JSON.parse(content);
    return {
      speakers,
      businessGoals: parsed.businessGoals || [],
      designNeeds: parsed.designNeeds || [],
      technicalSpecs: parsed.technicalSpecs || [],
      targetAudience: parsed.targetAudience || "Not specified",
      keyFeatures: parsed.keyFeatures || [],
      successMetrics: parsed.successMetrics || []
    };
  } catch (error) {
    console.error("[Ideation Engine] Failed to analyze ideation:", error);
    throw new Error("Failed to analyze project ideation.");
  }
}

/**
 * Generate comprehensive Final Decision Report
 */
export async function generateFinalDecisionReport(
  chatLogs: string,
  analysis: IdeationAnalysis
): Promise<FinalDecisionReport> {
  const prompt = `
Based on the team conversation and extracted requirements, generate a comprehensive Final Decision Report for this project.

This report will be used by:
- Designers to create mockups and user flows
- Business strategists to plan go-to-market strategy
- Developers to architect and build the solution
- Project managers to plan timeline and resources

Team Participants: ${analysis.speakers.map(s => `${s.name} (${s.role})`).join(", ")}

Extracted Requirements:
- Business Goals: ${analysis.businessGoals.join(", ")}
- Design Needs: ${analysis.designNeeds.join(", ")}
- Technical Specs: ${analysis.technicalSpecs.join(", ")}
- Target Audience: ${analysis.targetAudience}
- Key Features: ${analysis.keyFeatures.join(", ")}
- Success Metrics: ${analysis.successMetrics.join(", ")}

Generate a detailed, actionable report in JSON format.

Expected JSON structure:
{
  "projectName": "Concise project name",
  "executiveSummary": "2-3 paragraph overview of the project",
  "businessRequirements": {
    "goals": ["Specific business goal 1", "Specific business goal 2"],
    "targetMarket": "Detailed description of target market",
    "revenueModel": "How the project will generate revenue",
    "competitiveAdvantage": "What makes this unique"
  },
  "designRequirements": {
    "userExperience": ["UX requirement 1", "UX requirement 2"],
    "visualStyle": "Description of visual design direction",
    "accessibility": ["Accessibility requirement 1", "Accessibility requirement 2"],
    "platforms": ["Web", "Mobile", "etc."]
  },
  "technicalRequirements": {
    "architecture": "High-level architecture description",
    "technologies": ["Technology 1", "Technology 2"],
    "integrations": ["Integration 1", "Integration 2"],
    "scalability": "Scalability requirements and approach",
    "security": ["Security requirement 1", "Security requirement 2"]
  },
  "timeline": {
    "estimatedDuration": "X weeks/months",
    "phases": [
      {
        "name": "Phase name",
        "duration": "X weeks",
        "deliverables": ["Deliverable 1", "Deliverable 2"]
      }
    ]
  },
  "risks": [
    {
      "risk": "Potential risk description",
      "mitigation": "How to mitigate this risk"
    }
  ],
  "nextSteps": ["Immediate action 1", "Immediate action 2"]
}

Original Chat Logs:
"""
${chatLogs}
"""
`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert project strategist who creates comprehensive, actionable project reports for cross-functional teams." },
        { role: "user", content: prompt }
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 4096
    });

    const content = typeof result.choices[0].message.content === 'string'
      ? result.choices[0].message.content
      : JSON.stringify(result.choices[0].message.content);

    return JSON.parse(content) as FinalDecisionReport;
  } catch (error) {
    console.error("[Ideation Engine] Failed to generate final decision report:", error);
    throw new Error("Failed to generate final decision report.");
  }
}

/**
 * Complete ideation pipeline: identify speakers, analyze, and generate report
 */
export async function processIdeation(chatLogs: string): Promise<IdeationResult> {
  console.log("[Ideation Engine] Starting ideation processing...");

  // Step 1: Identify speakers
  console.log("[Ideation Engine] Identifying speakers...");
  const speakers = await identifySpeakers(chatLogs);
  console.log(`[Ideation Engine] Found ${speakers.length} speakers`);

  // Step 2: Analyze requirements
  console.log("[Ideation Engine] Analyzing requirements...");
  const aiAnalysis = await analyzeIdeation(chatLogs, speakers);
  console.log("[Ideation Engine] Analysis complete");

  // Step 3: Generate final decision report
  console.log("[Ideation Engine] Generating final decision report...");
  const finalDecisionReport = await generateFinalDecisionReport(chatLogs, aiAnalysis);
  console.log("[Ideation Engine] Report generated");

  return {
    chatLogs,
    speakers,
    aiAnalysis,
    finalDecisionReport
  };
}
