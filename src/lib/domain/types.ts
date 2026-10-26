export type Topology = 'series' | 'parallel';
export type CircuitInput = { topology: Topology; voltage: number; r1: number; r2: number };
export type CircuitOutput = { equivalentResistance: number; totalCurrent: number; current1: number; current2: number; voltage1: number; voltage2: number; power: number };
export type Course = { id: string; code: string; title: string; instructor: string; color: string; nextEvent: string; deadline: string };
export type Source = { id: string; courseId?: string; title: string; body: string; version: number; kind: 'synthetic' | 'upload' | 'email' | 'folder' | 'blackboard' | 'calendar' | 'gradescope' | 'piazza'; retrievedAt: string; status: 'current' | 'stale'; timezone?: string; origin?: 'synthetic' | 'manual-import' | 'live'; observedAt?: string; url?: string; modifiedAt?: string; provenance?: { origin: 'manual-course' | 'manual-email' | 'manual-calendar' | 'live-browser' | 'live-google'; sourceKey: string; contentHash: string; importedAt: string }; };
export type Lesson = {
  id: string; courseId: string; title: string; description: string; objective: string; reason: string;
  duration: number; kind: 'circuit' | 'practice'; circuit: CircuitInput; sourceIds: string[];
  sourceVersions: Record<string, number>; modelVersion: string; version: number;
  state: 'ready' | 'stale'; examEligible: boolean; mode: 'prepared' | 'live';
  question: string; options: string[]; answerIndex: number; explanation: string; hint: string;
  exposure?: 'lab' | 'fresh-no-diagram'; parentLessonId?: string; predictionId?: string;
  validation?: { status: 'development-preview' | 'checked'; modelVersion: string; checkedAt?: string; reviewer?: string };
  inputRanges?: { voltage: { min: number; max: number; unit: 'V' }; r1: { min: number; max: number; unit: 'Ω' }; r2: { min: number; max: number; unit: 'Ω' } };
  checkpoint?: PredictionCheckpoint;
  supportingPassages?: { sourceId: string; version: number; quote: string }[];
};
export type Attempt = {
  id: string; lessonId: string; lessonVersion: number; modelVersion: string; question: string;
  response: string; correct: boolean; assisted: boolean; assistance: string[];
  createdAt: string; revisionOf?: string; novel: boolean; feedback: string; sourceVersions?: Record<string, number>; exposure?: 'lab' | 'fresh-no-diagram'; predictionId?: string;
};
export type AgentRun = { id: string; trigger: string; mode: 'synthetic' | 'prepared' | 'live'; status: 'completed' | 'failed' | 'unchanged'; createdAt: string; steps: string[]; effect: string; sourceIds: string[]; };
export type Interpretation = { id: string; courseId: string; claim: string; status: 'suspected' | 'revised' | 'supported'; evidenceIds: string[]; reason: string; updatedAt: string };
export type WorkspaceState = {
  id: string; mode: 'demo' | 'account'; createdAt: string; expiresAt: string;
  revision: number; importReceipts?: { key: string; sourceId: string; hash: string; importedAt: string; preparationRevision?: number }[]; timezone?: string; demoClock?: string;
  focusWindows?: FocusWindow[]; calendarContext?: CalendarContext;
  commitmentObservations?: CommitmentObservation[]; commitments?: Commitment[]; corrections?: CommitmentCorrection[]; consequences?: Consequence[];
  selectedSessionMinutes?: 10 | 20 | 45; sessionRecommendation?: SessionRecommendation;
  predictions?: PredictionInteraction[]; predictionStates?: Record<string, PredictionState>; freshRequests?: FreshRequest[];
  courses: Course[]; sources: Source[]; lessons: Lesson[];
  attempts: Attempt[]; runs: AgentRun[]; interpretations: Interpretation[];
  preferences: { sessionMinutes: number; workedExamples: boolean };
  assistance: Record<string, string[]>; savedInputs: Record<string, CircuitInput>;
  reviews: { lessonId: string; dueAt: string; rating: string; reviewedAt?: string; scheduler?: 'ts-fsrs-5.4.2'; card?: { due: string; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; learning_steps: number; reps: number; lapses: number; state: number; last_review?: string } }[];
};
export type WorkspaceAction =
  | { type: 'refresh' }
  | { type: 'scenario'; scenario: 'exam-moved' | 'scope-change' | 'source-revised' | 'source-expired' | 'reconnect' | 'injection' | 'commitment-overlap' | 'commitment-no-overlap' | 'commitment-tentative' | 'commitment-duplicate' }
  | { type: 'assistance'; lessonId: string; kind: 'hint' | 'explanation' | 'exploration' }
  | { type: 'attempt'; lessonId: string; optionIndex: number; revisionOf?: string }
  | { type: 'request-lesson'; courseId: string; topic: string }
  | { type: 'save-inputs'; lessonId: string; inputs: CircuitInput }
  | { type: 'preference'; sessionMinutes?: number; workedExamples?: boolean }
  | { type: 'review'; lessonId: string; rating: 'Again' | 'Hard' | 'Good' | 'Easy' }
  | { type: 'select-session'; minutes: 10 | 20 | 45 }
  | { type: 'focus-window'; startAt: string; endAt: string; timezone: string }
  | { type: 'correct-commitment'; commitmentId: string; status?: 'confirmed' | 'tentative' | 'cancelled'; startAt?: string; endAt?: string; timezone?: string; note: string }
  | { type: 'prediction'; lessonId: string; optionIndex: number }
  | { type: 'reveal-prediction'; lessonId: string }
  | { type: 'explore-lesson'; lessonId: string }
  | { type: 'fresh-question'; lessonId: string; when: 'now' | 'later' }
  | { type: 'reset' };
export type WorkspaceResponse = { workspace: WorkspaceState; capabilities: { spark: boolean; persistence: 'local-synthetic' | 'firestore'; liveSources: string[] }; notice?: string };

export type SourceRef = { sourceId: string; version: number };
export type FocusWindow = { id: string; startAt: string; endAt: string; timezone: string; declaredAt: string };
export type CalendarContext = { status: 'current' | 'stale' | 'missing'; sourceRefs: SourceRef[]; checkedAt: string; mode: 'synthetic' | 'manual-import' | 'live' };
export type CommitmentStatus = 'confirmed' | 'tentative' | 'conflict' | 'cancelled';
export type CommitmentObservation = {
  id: string; workspaceId: string; eventId: string; title: string; category: 'Interview' | 'Personal' | 'Application'; kind: 'event' | 'deadline';
  startAt: string; endAt: string; timezone: string; status: 'confirmed' | 'tentative' | 'cancelled';
  bufferBeforeMinutes: number; bufferAfterMinutes: number; blocksFocus?: boolean; sourceRefs: SourceRef[]; observedAt: string; identityBasis: string;
};
export type Commitment = Omit<CommitmentObservation, 'eventId' | 'status'> & { status: CommitmentStatus; observationIds: string[]; correctionId?: string };
export type CommitmentCorrection = { id: string; workspaceId: string; commitmentId: string; createdAt: string; note: string; fields?: ('status' | 'startAt' | 'endAt' | 'timezone')[]; before: { status: CommitmentStatus; startAt: string; endAt: string; timezone: string }; after: { status: 'confirmed' | 'tentative' | 'cancelled'; startAt: string; endAt: string; timezone: string } };
export type Consequence = { id: string; workspaceId: string; createdAt: string; trigger: string; classification: 'timing' | 'scope' | 'content' | 'availability' | 'uncertainty' | 'identity' | 'correction'; sourceRefs: SourceRef[]; affectedIds: string[]; before: Record<string, string | number | boolean | null>; after: Record<string, string | number | boolean | null>; reason: string; result: string };
export type SessionRecommendation = { minutes: 10 | 20 | 45; availableMinutes: number | null; status: 'known' | 'uncertain' | 'stale' | 'missing'; sourceRefs: SourceRef[]; contextRevision: number; updatedAt: string; reason: string };
export type PredictionCheckpoint = { id: string; question: string; options: string[]; answerIndex: number; revealLabel: string; parameter: 'r2'; multiplier: number; observedOutput: 'current1' | 'voltage2'; explanation: string };
export type PredictionInteraction = { id: string; lessonId: string; lessonVersion: number; modelVersion: string; kind: 'selection' | 'exploration' | 'reveal'; createdAt: string; inputs: CircuitInput; optionIndex?: number; predictionId?: string; resultInputs?: CircuitInput; result?: CircuitOutput; matched?: boolean; comparisonValid?: boolean; checkpoint?: PredictionCheckpoint };
export type PredictionState = { state: 'idle' | 'exploring' | 'predicted' | 'revealed'; selectedPredictionId?: string; revealId?: string };
export type FreshRequest = { id: string; parentLessonId: string; lessonId: string; predictionId?: string; requestedAt: string; when: 'now' | 'later'; status: 'pending' | 'opened'; openedAt?: string };
