# LLM Integration — Interview Q&A

## 1. Why build a provider abstraction?

**Answer:** Gemini and Groq expose different model identifiers, request payloads, streaming formats, errors and usage metadata. An adapter normalizes common behavior so the application can keep provider details out of routes and UI. The abstraction should expose capabilities and errors honestly rather than pretending every model is interchangeable.

## 2. How is a model selected?

**Answer:** A provider/model policy layer maps accepted application-level model identifiers to allowed provider/model configurations and plan policy. The server validates the request and must not blindly forward arbitrary model names or provider URLs supplied by the client. Confirm exact current policy in the provider implementation before naming models.

## 3. Where are API keys stored?

**Answer:** Provider keys are server-side only. In local review, a developer can provide an environment variable before starting the backend. In deployment, the documented design uses Key Vault and managed identity/secret references. Keys must never be shipped to the browser or logged.

## 4. How do you normalize streaming?

**Answer:** The provider adapter converts provider-specific chunks into a common internal event/response model. The generation service controls lifecycle and persistence; the API emits the app's SSE contract. This isolates UI code from provider-specific formats.

## 5. How do you handle token limits and costs?

**Answer:** Enforce maximum prompt/context/output limits and plan-specific usage controls before calling a provider. Reserve usage to coordinate concurrent requests, then settle actual usage or release reservation on failure. Provider token accounting differs, so track provider-reported usage when available and define a conservative fallback.

## 6. What if the provider times out after producing partial text?

**Answer:** Persist the generation state and partial output, mark a terminal or recoverable status, cancel upstream work where supported and settle/release usage according to policy. Return a clear stream error. A retry must not silently create a duplicate generation if the original request may have succeeded.

## 7. Can you automatically fail over from Gemini to Groq?

**Answer:** Technically possible, but not always semantically safe. Providers differ in context windows, tool support, latency, safety behavior and output quality. Failover needs explicit policy, retry limits, observability and correct accounting; never hide which model actually served the request.

## 8. How do you evaluate output quality?

**Answer:** Build representative prompts and a versioned evaluation set, assess correctness and task-specific criteria, compare model versions, and track latency/cost alongside quality. Deterministic fixtures test application behavior, not LLM quality. Human review remains useful for subjective responses.

## 9. How do you mitigate prompt injection?

**Answer:** Treat user and retrieved content as untrusted, separate instructions from data, restrict tools and permissions, validate tool arguments server-side, avoid giving the model credentials, and require authorization outside the model. The current documented scope does not expose a complete web-search or document-retrieval tool chain.

## 10. What are current feature boundaries?

**Answer:** Provider adapters exist, but real inference requires valid credentials, accessible model IDs, quota and provider availability. Image upload/display does not prove image understanding. Web search, image generation, voice, document retrieval, scheduled tasks and sandboxed code execution are not documented as working user-facing features.
