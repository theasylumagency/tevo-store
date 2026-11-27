// Loaded only in the disposable browser-test server. Never contact a paid provider.
const original = globalThis.fetch;
globalThis.fetch = async (resource, options) => {
  const url = typeof resource === "string" ? resource : resource.url ?? String(resource);
  if (url !== "https://api.openai.com/v1/responses") return original(resource, options);
  const raw = options?.body != null ? await new Response(options.body).text() : await resource.text();
  const body = JSON.parse(raw);
  const { facts } = JSON.parse(body.input);
  const paragraphs = [{ text: facts[0].value + " · სატესტო ჯგუფის აღწერა.", sources: [1] }];
  return Response.json({ status: "completed", output: [{ type: "message", content: [
    { type: "output_text", text: JSON.stringify({ paragraphs }) },
  ] }] });
};
