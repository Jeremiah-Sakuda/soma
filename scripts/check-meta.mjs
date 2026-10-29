// One explicitly requested, bounded connectivity probe. Never print credentials.
const key = process.env.MODEL_API_KEY?.trim();
if (!key) {
  console.error('MODEL_API_KEY is empty. Fill .env.local and rerun.');
  process.exit(1);
}
const base = process.env.META_API_BASE_URL || 'https://api.meta.ai/v1';
if (base !== 'https://api.meta.ai/v1') throw new Error('Unexpected Meta endpoint; probe stopped.');
const model = process.env.META_MODEL_ID || 'muse-spark-1.3';
const start = Date.now();
try {
  const response = await fetch(`${base}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: 'Reply with exactly SOMA_OK.', reasoning: { effort: 'minimal' }, max_output_tokens: 512 }),
    signal: AbortSignal.timeout(45000),
  });
  const data = await response.json();
  const output = (data.output ?? []).flatMap(item => item.content ?? [])
    .filter(item => item.type === 'output_text').map(item => item.text).join('');
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), model, httpStatus: response.status,
    responseStatus: data.status ?? null, latencyMs: Date.now() - start,
    expectedReplyReceived: output.trim() === 'SOMA_OK',
    usage: data.usage ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens, totalTokens: data.usage.total_tokens } : null,
    errorType: response.ok ? null : String(data.error?.type ?? 'provider_error'),
    errorCode: response.ok ? null : String(data.error?.code ?? 'unknown'),
  }, null, 2));
  if (!response.ok || output.trim() !== 'SOMA_OK') process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ error: 'Meta connectivity probe failed', type: error.name, latencyMs: Date.now() - start }));
  process.exitCode = 1;
}
