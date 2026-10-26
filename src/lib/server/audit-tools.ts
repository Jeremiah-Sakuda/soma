import { z } from 'zod';

/** Concise operational justifications travel in the existing tool call, not a narration call. */
export function withAuditRationales<T extends { parameters: unknown }>(tools: readonly T[]) {
  return tools.map(tool => {
    const parameters = tool.parameters as { properties: Record<string, unknown>; required?: string[]; [key: string]: unknown };
    return { ...tool, parameters: { ...parameters,
      properties: { ...parameters.properties, auditRationale: { type: 'string', minLength: 10, maxLength: 280, description: 'Brief evidence-based purpose for this proposed action. State uncertainty when relevant. A stated operational justification, without private internal reasoning.' } },
      required: [...new Set([...(parameters.required ?? []), 'auditRationale'])],
    } };
  });
}

/** Old stored/scripted calls may lack a rationale; never invent one retrospectively. */
export function splitAuditRationale(raw: Record<string, unknown>): { args: Record<string, unknown>; rationale?: string } {
  const { auditRationale: supplied, ...args } = raw;
  const rationale = supplied === undefined ? undefined : z.string().trim().min(10).max(280).parse(supplied);
  return { args, ...(rationale ? { rationale } : {}) };
}
