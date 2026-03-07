import { invokeLLM } from "./llm";

export interface ParsedPRD {
    clientFirstName: string;
    clientLastName: string;
    clientEmail?: string;
    clientPhone?: string;
    projectName: string;
    projectDefinition: string;
    projectScope: string;
    dateReceived?: string; // ISO string if found
}

export async function parsePRDText(text: string): Promise<ParsedPRD> {
    const prompt = `
    Analyze the following Project Requirements Document (PRD) and extract the specified details in JSON format.
    
    Expected JSON structure:
    {
      "clientFirstName": "First name of the client or primary contact",
      "clientLastName": "Last name of the client or primary contact",
      "clientEmail": "Email address of the client if found",
      "clientPhone": "Phone number of the client if found",
      "projectName": "A concise name for the project",
      "projectDefinition": "A high-level definition of what the project is (1-2 sentences)",
      "projectScope": "A detailed summary of the project's scope, requirements, and deliverables",
      "dateReceived": "The date and time the document was received, formatted as ISO 8601 (e.g., '2024-03-07T10:00:00Z'). If not found, leave as null."
    }

    Rules:
    - If a first or last name is missing, use "Unknown".
    - If the project name isn't explicit, derive one from the content.
    - projectDefinition should be very concise.
    - projectScope should be comprehensive but clear.

    PRD Text:
    """
    ${text}
    """
  `;

    try {
        const result = await invokeLLM({
            messages: [
                { role: "system", content: "You are an expert project manager and analyst." },
                { role: "user", content: prompt }
            ],
            responseFormat: { type: "json_object" }
        });

        const content = typeof result.choices[0].message.content === 'string'
            ? result.choices[0].message.content
            : JSON.stringify(result.choices[0].message.content);

        return JSON.parse(content) as ParsedPRD;
    } catch (error) {
        console.error("[PRD Parser] Failed to parse text:", error);
        throw new Error("Failed to extract project details from the document.");
    }
}
