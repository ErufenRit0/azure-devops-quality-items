import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import Anthropic from "@anthropic-ai/sdk";

// Keep these in sync with src/common/fields.ts in the extension.
const QUALITY_CATEGORY_VALUES = [
  "Functional",
  "Performance",
  "Security",
  "Usability",
  "Documentation",
  "Compliance",
] as const;

const ROOT_CAUSE_VALUES = [
  "Requirement Gap",
  "Design Flaw",
  "Code Defect",
  "Test Gap",
  "Process Issue",
  "Environment/Infrastructure",
  "Other",
] as const;

interface ClassifyRequestBody {
  title?: string;
  description?: string;
}

interface ClassificationResult {
  suggestedQualityCategory: string;
  suggestedRootCause: string;
  summary: string;
  confidence: number;
}

// Reads ANTHROPIC_API_KEY from the Function App's application settings.
const client = new Anthropic();

export async function classifyQualityItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let body: ClassifyRequestBody;
  try {
    body = (await request.json()) as ClassifyRequestBody;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  const title = (body.title ?? "").slice(0, 2000);
  const description = (body.description ?? "").slice(0, 8000);

  if (!title && !description) {
    return { status: 400, jsonBody: { error: "title or description is required" } };
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              suggestedQualityCategory: { type: "string", enum: [...QUALITY_CATEGORY_VALUES] },
              suggestedRootCause: { type: "string", enum: [...ROOT_CAUSE_VALUES] },
              summary: {
                type: "string",
                description: "One or two sentence summary of the likely issue.",
              },
              confidence: {
                type: "number",
                description: "Confidence in this classification, from 0 to 1.",
              },
            },
            required: ["suggestedQualityCategory", "suggestedRootCause", "summary", "confidence"],
            additionalProperties: false,
          },
        },
      },
      system:
        "You classify Azure DevOps 'Quality Item' work items. Given a title and description, pick " +
        "the single best-fitting Quality Category and Root Cause from the allowed picklists, and " +
        "write a one- or two-sentence summary of the likely issue. Be conservative with confidence " +
        "when the title/description don't give you enough to go on.",
      messages: [
        {
          role: "user",
          content: `Title: ${title || "(none)"}\n\nDescription:\n${description || "(none)"}`,
        },
      ],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (!textBlock) {
      throw new Error("No text content in Claude response");
    }

    const result = JSON.parse(textBlock.text) as ClassificationResult;
    return { status: 200, jsonBody: result };
  } catch (error) {
    context.error("Claude classification failed", error);
    return { status: 502, jsonBody: { error: "AI classification failed" } };
  }
}

app.http("classifyQualityItem", {
  methods: ["POST"],
  authLevel: "function",
  handler: classifyQualityItem,
});
