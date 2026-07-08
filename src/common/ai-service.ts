export interface ClassificationResult {
  suggestedQualityCategory: string;
  suggestedRootCause: string;
  summary: string;
  confidence: number;
}

// TODO: point this at your own backend (e.g. an Azure Function) that proxies
// the LLM call server-side. Never call an LLM API directly from this
// client-side extension code - that would expose your API key to every user
// who opens the work item form.
const AI_BACKEND_URL = "";

export async function classifyQualityItem(title: string, description: string): Promise<ClassificationResult> {
  if (!AI_BACKEND_URL) {
    throw new Error(
      "AI backend not configured. Set AI_BACKEND_URL in src/common/ai-service.ts to a server-side " +
        "endpoint that calls the LLM API on your behalf."
    );
  }

  const response = await fetch(AI_BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });

  if (!response.ok) {
    throw new Error(`AI backend request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ClassificationResult;
}
