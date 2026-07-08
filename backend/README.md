# Quality Items AI Backend

An Azure Function (Node.js, TypeScript, HTTP trigger) that proxies AI classification requests from the extension's "Suggest classification with AI" button to the Claude API. This exists so the Anthropic API key never reaches the browser - see `src/common/ai-service.ts` in the extension for the client side of this contract.

## Endpoint contract

`POST /api/classifyQualityItem`

Request body:

```json
{ "title": "...", "description": "..." }
```

Response body (matches `ClassificationResult` in `src/common/ai-service.ts`):

```json
{
  "suggestedQualityCategory": "Security",
  "suggestedRootCause": "Design Flaw",
  "summary": "...",
  "confidence": 0.7
}
```

## Local development

```bash
npm install
cp local.settings.json.example local.settings.json
# edit local.settings.json and set ANTHROPIC_API_KEY
npm start   # requires Azure Functions Core Tools (func)
```

## Deploying

1. Create an Azure Function App (Consumption plan is fine for this workload) with the Node.js runtime.
2. Set the `ANTHROPIC_API_KEY` application setting (Function App > Configuration) - never commit it.
3. Deploy via `func azure functionapp publish <app-name>` or your CI of choice.
4. Copy the function's invoke URL (including the `?code=` function key, or front it with APIM/Easy Auth) and set it as `AI_BACKEND_URL` in the extension's `src/common/ai-service.ts`.
5. **Lock down CORS** (Function App > CORS) to the actual origin Azure DevOps serves extension iframes from in your org, instead of the `local.settings.json.example` wildcard - check your browser's network tab while the extension panel is open to find the exact origin.

## Notes

- Uses `claude-opus-4-8` with `output_config.format` (structured JSON output) so the response always matches the extension's expected shape - no manual JSON parsing/repair needed.
- `QUALITY_CATEGORY_VALUES` / `ROOT_CAUSE_VALUES` are duplicated here from `src/common/fields.ts` (a Function can't import from the extension's `src/` across the package boundary); keep them in sync if you change the picklists.
- No rate limiting or cost controls are implemented yet - add them (e.g. Azure API Management, or a simple per-user quota) before exposing this broadly, since every click costs an API call.
