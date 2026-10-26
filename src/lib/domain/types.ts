export type Topology = 'series' | 'parallel';
export type CircuitInput = { topology: Topology; voltage: number; r1: number; r2: number };
export type CircuitOutput = { equivalentResistance: number; totalCurrent: number; current1: number; current2: number; voltage1: number; voltage2: number; power: number };
export type Course = { id: string; code: string; title: string; instructor: string; color: string; nextEvent: string; deadline: string };
export type Source = { id: string; courseId: string; title: string; body: string; version: number; kind: 'synthetic' | 'upload' | 'email' | 'folder' | 'blackboard'; retrievedAt: string; status: 'current' | 'stale'; };
export type Lesson = {
  id: string; courseId: string; title: string; description: string; objective: string; reason: string;
  duration: number; kind: 'circuit' | 'practice'; circuit: CircuitInput; sourceIds: string[];
  sourceVersions: Record<string, number>; modelVersion: string; version: number;
  state: 'ready' | 'stale'; examEligible: boolean; mode: 'prepared' | 'live';
  question: string; options: string[]; answerIndex: number; explanation: string; hint: string;
};
export type Attempt = {
  id: string; lessonId: string; lessonVersion: number; modelVersion: string; question: string;
  response: string; correct: boolean; assisted: boolean; assistance: string[];
  createdAt: string; revisionOf?: string; novel: boolean; feedback: string; sourceVersions?: Record<string, number>;
};
export type AgentRun = { id: string; trigger: string; mode: 'synthetic' | 'live'; status: 'completed' | 'failed' | 'unchanged'; createdAt: string; steps: string[]; effect: string; sourceIds: string[]; };
export type Interpretation = { id: string; courseId: string; claim: string; status: 'suspected' | 'revised' | 'supported'; evidenceIds: string[]; reason: string; updatedAt: string };
export type WorkspaceState = {
  id: string; mode: 'demo' | 'account'; createdAt: string; expiresAt: string;
  revision: number; courses: Course[]; sources: Source[]; lessons: Lesson[];
  attempts: Attempt[]; runs: AgentRun[]; interpretations: Interpretation[];
  preferences: { sessionMinutes: number; workedExamples: boolean };
  assistance: Record<string, string[]>; savedInputs: Record<string, CircuitInput>;
  reviews: { lessonId: string; dueAt: string; rating: string }[];
};
export type WorkspaceAction =
  | { type: 'refresh' }
  | { type: 'scenario'; scenario: 'exam-moved' | 'scope-change' | 'source-revised' | 'source-expired' | 'reconnect' | 'injection' }
  | { type: 'assistance'; lessonId: string; kind: 'hint' | 'explanation' | 'exploration' }
  | { type: 'attempt'; lessonId: string; optionIndex: number; revisionOf?: string }
  | { type: 'request-lesson'; courseId: string; topic: string }
  | { type: 'save-inputs'; lessonId: string; inputs: CircuitInput }
  | { type: 'preference'; sessionMinutes?: number; workedExamples?: boolean }
  | { type: 'review'; lessonId: string; rating: 'Again' | 'Hard' | 'Good' | 'Easy' }
  | { type: 'reset' };
export type WorkspaceResponse = { workspace: WorkspaceState; capabilities: { spark: boolean; persistence: 'local-synthetic' | 'firestore'; liveSources: string[] }; notice?: string };
