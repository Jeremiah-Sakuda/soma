import { z } from "zod";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const text = (length: number) => z.string().trim().min(1).max(length);
export const memoryReferenceSchema = z
  .object({ artifactId: id, version: z.number().int().positive() })
  .strict();
export type MemoryReference = z.infer<typeof memoryReferenceSchema>;
export type BoundMemoryReference = MemoryReference & {
  observationId: string;
  sourceVersion: number;
};
const concept = z
  .object({
    id,
    label: text(100),
    summary: text(500),
    uncertainty: z.array(text(200)).max(4),
    refs: z.array(memoryReferenceSchema).min(1).max(4),
  })
  .strict();
const relationship = z
  .object({
    id,
    from: id,
    to: id,
    kind: z.enum(["related", "prerequisite", "contrast", "transfer"]),
    reason: text(400),
    refs: z.array(memoryReferenceSchema).min(1).max(4),
  })
  .strict();
const recommendation = z
  .object({
    question: text(400),
    reason: text(400),
    conceptIds: z.array(id).max(4),
    refs: z.array(memoryReferenceSchema).min(1).max(4),
  })
  .strict();
/** Model proposals cannot create user goals, observations, scores or mastery. */
export const companionMemoryProposalSchema = z
  .object({
    concepts: z.array(concept).max(8),
    relationships: z.array(relationship).max(12),
    nextActivity: recommendation.optional(),
  })
  .strict();
export type CompanionMemoryProposal = z.infer<
  typeof companionMemoryProposalSchema
>;
export type MemoryGoal = {
  id: string;
  revision: number;
  kind: "goal" | "preference";
  text: string;
  createdAt: string;
  provenance: "self-report";
};
export type MemoryConcept = Omit<z.infer<typeof concept>, "refs"> & {
  refs: BoundMemoryReference[];
  revision: number;
  createdAt: string;
  provenance: "model-proposal" | "user-correction";
};
export type MemoryRelationship = Omit<z.infer<typeof relationship>, "refs"> & {
  refs: BoundMemoryReference[];
  revision: number;
  createdAt: string;
  provenance: "model-proposal";
};
export type MemoryRecommendation = Omit<
  z.infer<typeof recommendation>,
  "refs"
> & {
  refs: BoundMemoryReference[];
  createdAt: string;
  provenance: "model-proposal";
};
export type CompanionMemory = {
  schemaVersion: 1;
  revision: number;
  goals: MemoryGoal[];
  concepts: MemoryConcept[];
  relationships: MemoryRelationship[];
  nextActivity?: MemoryRecommendation;
};
export type MemoryEvidence = {
  id: string;
  kind: "prediction" | "application";
  ref: BoundMemoryReference;
  recordedAt: string;
  answer: string;
  reason: string;
  matches: boolean;
  exposure: "diagram-visible-practice" | "fresh-problem-reference-available";
  assistance: "diagram-visible" | "hint" | "reference-available";
  revealedBeforeAnswer: boolean;
};
export type CompanionMemoryView = {
  revision: number;
  goals: MemoryGoal[];
  concepts: MemoryConcept[];
  relationships: MemoryRelationship[];
  evidence: MemoryEvidence[];
  nextActivity?: MemoryRecommendation;
};
export const companionMemoryCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("upsert-goal"),
      revision: z.number().int().nonnegative(),
      id: id.optional(),
      kind: z.enum(["goal", "preference"]),
      text: text(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("delete-goal"),
      revision: z.number().int().nonnegative(),
      id,
    })
    .strict(),
  z
    .object({
      action: z.literal("correct-concept"),
      revision: z.number().int().nonnegative(),
      id,
      label: text(100),
      summary: text(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("delete-concept"),
      revision: z.number().int().nonnegative(),
      id,
    })
    .strict(),
  z
    .object({
      action: z.literal("delete-relationship"),
      revision: z.number().int().nonnegative(),
      id,
    })
    .strict(),
  z
    .object({
      action: z.literal("reset"),
      revision: z.number().int().nonnegative(),
    })
    .strict(),
]);
export type CompanionMemoryCommand = z.infer<
  typeof companionMemoryCommandSchema
>;
