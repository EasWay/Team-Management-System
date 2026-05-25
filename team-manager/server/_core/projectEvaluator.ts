import { invokeLLM } from "./llm";

export interface AlignmentScore {
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
  strengths: string[];
}

export interface EvaluationResult {
  overallScore: number; // 0-100
  designAlignment: AlignmentScore;
  businessAlignment: AlignmentScore;
  technicalQuality: AlignmentScore;
  testingProtocol: string[];
  readyForLaunch: boolean;
  criticalIssues: string[];
  recommendations: string[];
  evaluatedAt: string;
}

/**
 * Evaluate design alignment with original requirements
 */
async function evaluateDesignAlignment(
  originalRequirements: any,
  designDeliverables: any[]
): Promise<AlignmentScore> {
  const prompt = `
Evaluate the design deliverables against the original project requirements.

Original Requirements:
${JSON.stringify(originalRequirements, null, 2)}

Design Deliverables:
${JSON.stringify(designDeliverables, null, 2)}

Analyze:
1. Does the design meet the user experience requirements?
2. Is the visual style aligned with the target audience?
3. Are accessibility requirements addressed?
4. Are all key features represented in the design?

Return a JSON evaluation:
{
  "score": 0-100,
  "issues": ["Issue 1", "Issue 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "strengths": ["Strength 1", "Strength 2"]
}
`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert UX/UI design evaluator." },
        { role: "user", content: prompt }
      ],
      responseFormat: { type: "json_object" }
    });

    const content = typeof result.choices[0].message.content === 'string'
      ? result.choices[0].message.content
      : JSON.stringify(result.choices[0].message.content);

    return JSON.parse(content);
  } catch (error) {
    console.error("[Project Evaluator] Design evaluation failed:", error);
    return {
      score: 0,
      issues: ["Failed to evaluate design"],
      recommendations: [],
      strengths: [],
    };
  }
}

/**
 * Evaluate business alignment with goals and strategy
 */
async function evaluateBusinessAlignment(
  originalRequirements: any,
  businessDeliverables: any[]
): Promise<AlignmentScore> {
  const prompt = `
Evaluate the business strategy deliverables against the original project requirements.

Original Requirements:
${JSON.stringify(originalRequirements, null, 2)}

Business Deliverables:
${JSON.stringify(businessDeliverables, null, 2)}

Analyze:
1. Does the strategy align with business goals?
2. Is the target market properly addressed?
3. Is the revenue model viable?
4. Are competitive advantages clearly defined?
5. Are success metrics measurable?

Return a JSON evaluation:
{
  "score": 0-100,
  "issues": ["Issue 1", "Issue 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "strengths": ["Strength 1", "Strength 2"]
}
`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert business strategist and analyst." },
        { role: "user", content: prompt }
      ],
      responseFormat: { type: "json_object" }
    });

    const content = typeof result.choices[0].message.content === 'string'
      ? result.choices[0].message.content
      : JSON.stringify(result.choices[0].message.content);

    return JSON.parse(content);
  } catch (error) {
    console.error("[Project Evaluator] Business evaluation failed:", error);
    return {
      score: 0,
      issues: ["Failed to evaluate business strategy"],
      recommendations: [],
      strengths: [],
    };
  }
}

/**
 * Evaluate technical quality and implementation
 */
async function evaluateTechnicalQuality(
  originalRequirements: any,
  technicalDeliverables: any[]
): Promise<AlignmentScore> {
  const prompt = `
Evaluate the technical implementation against the original project requirements.

Original Requirements:
${JSON.stringify(originalRequirements, null, 2)}

Technical Deliverables:
${JSON.stringify(technicalDeliverables, null, 2)}

Analyze:
1. Is the architecture appropriate for the requirements?
2. Are the chosen technologies suitable?
3. Are security requirements addressed?
4. Is scalability considered?
5. Are integrations properly implemented?
6. Is code quality and documentation adequate?

Return a JSON evaluation:
{
  "score": 0-100,
  "issues": ["Issue 1", "Issue 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "strengths": ["Strength 1", "Strength 2"]
}
`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert software architect and code reviewer." },
        { role: "user", content: prompt }
      ],
      responseFormat: { type: "json_object" }
    });

    const content = typeof result.choices[0].message.content === 'string'
      ? result.choices[0].message.content
      : JSON.stringify(result.choices[0].message.content);

    return JSON.parse(content);
  } catch (error) {
    console.error("[Project Evaluator] Technical evaluation failed:", error);
    return {
      score: 0,
      issues: ["Failed to evaluate technical implementation"],
      recommendations: [],
      strengths: [],
    };
  }
}

/**
 * Generate comprehensive testing protocol
 */
async function generateTestingProtocol(
  projectData: any,
  allDeliverables: any
): Promise<string[]> {
  const prompt = `
Generate a comprehensive testing protocol for this project.

Project Information:
${JSON.stringify(projectData, null, 2)}

All Deliverables:
${JSON.stringify(allDeliverables, null, 2)}

Create a detailed testing checklist covering:
1. Unit testing requirements
2. Integration testing scenarios
3. User acceptance testing (UAT) criteria
4. Performance testing benchmarks
5. Security testing requirements
6. Accessibility testing checklist
7. Cross-browser/platform testing
8. Load testing scenarios
9. Edge cases and error handling
10. Regression testing plan

Return a JSON array of testing items:
{
  "testingProtocol": [
    "Test item 1",
    "Test item 2",
    ...
  ]
}
`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert QA engineer and testing strategist." },
        { role: "user", content: prompt }
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 2048
    });

    const content = typeof result.choices[0].message.content === 'string'
      ? result.choices[0].message.content
      : JSON.stringify(result.choices[0].message.content);

    const parsed = JSON.parse(content);
    return parsed.testingProtocol || [];
  } catch (error) {
    console.error("[Project Evaluator] Testing protocol generation failed:", error);
    return [
      "Failed to generate testing protocol",
      "Manual testing plan required"
    ];
  }
}

/**
 * Comprehensive project evaluation
 */
export async function evaluateProject(projectData: {
  id: number;
  name: string;
  ideationData?: any;
  deliverables?: any;
  handoffHistory?: any[];
}): Promise<EvaluationResult> {
  console.log(`[Project Evaluator] Starting evaluation for project: ${projectData.name}`);

  // Extract original requirements from ideation data
  const originalRequirements = projectData.ideationData?.finalDecisionReport || {};

  // Extract deliverables by role
  const allDeliverables = projectData.deliverables || {};
  const designDeliverables = allDeliverables.designer || [];
  const businessDeliverables = allDeliverables.business_strategist || [];
  const technicalDeliverables = [
    ...(allDeliverables.backend_dev || []),
    ...(allDeliverables.frontend_dev || [])
  ];

  // Run evaluations in parallel
  console.log("[Project Evaluator] Running parallel evaluations...");
  const [designAlignment, businessAlignment, technicalQuality, testingProtocol] = await Promise.all([
    evaluateDesignAlignment(originalRequirements, designDeliverables),
    evaluateBusinessAlignment(originalRequirements, businessDeliverables),
    evaluateTechnicalQuality(originalRequirements, technicalDeliverables),
    generateTestingProtocol(projectData, allDeliverables)
  ]);

  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    (designAlignment.score * 0.3) +
    (businessAlignment.score * 0.3) +
    (technicalQuality.score * 0.4)
  );

  // Collect critical issues (score < 50)
  const criticalIssues: string[] = [];
  if (designAlignment.score < 50) {
    criticalIssues.push(...designAlignment.issues.map(i => `[Design] ${i}`));
  }
  if (businessAlignment.score < 50) {
    criticalIssues.push(...businessAlignment.issues.map(i => `[Business] ${i}`));
  }
  if (technicalQuality.score < 50) {
    criticalIssues.push(...technicalQuality.issues.map(i => `[Technical] ${i}`));
  }

  // Collect all recommendations
  const recommendations = [
    ...designAlignment.recommendations.map(r => `[Design] ${r}`),
    ...businessAlignment.recommendations.map(r => `[Business] ${r}`),
    ...technicalQuality.recommendations.map(r => `[Technical] ${r}`)
  ];

  // Determine if ready for launch
  const readyForLaunch = overallScore >= 70 && criticalIssues.length === 0;

  const evaluation: EvaluationResult = {
    overallScore,
    designAlignment,
    businessAlignment,
    technicalQuality,
    testingProtocol,
    readyForLaunch,
    criticalIssues,
    recommendations,
    evaluatedAt: new Date().toISOString(),
  };

  console.log(`[Project Evaluator] Evaluation complete. Overall score: ${overallScore}/100`);
  return evaluation;
}

/**
 * Quick evaluation summary (for dashboard)
 */
export async function quickEvaluate(projectData: any): Promise<{
  score: number;
  status: 'excellent' | 'good' | 'needs_work' | 'critical';
  message: string;
}> {
  const evaluation = await evaluateProject(projectData);

  let status: 'excellent' | 'good' | 'needs_work' | 'critical';
  let message: string;

  if (evaluation.overallScore >= 90) {
    status = 'excellent';
    message = 'Project exceeds expectations and is ready for launch!';
  } else if (evaluation.overallScore >= 70) {
    status = 'good';
    message = 'Project meets requirements with minor improvements needed.';
  } else if (evaluation.overallScore >= 50) {
    status = 'needs_work';
    message = 'Project needs significant improvements before launch.';
  } else {
    status = 'critical';
    message = 'Project has critical issues that must be addressed.';
  }

  return {
    score: evaluation.overallScore,
    status,
    message,
  };
}
