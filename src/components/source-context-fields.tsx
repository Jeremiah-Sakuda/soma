'use client';
import type { Source } from '@/lib/domain/types';
import type { SourceAuthorityContext, Assessment } from '@/lib/domain/source-context';

/** Optional owner declarations; source titles and senders are never authority defaults. */
export function SourceContextFields({
  prefix,
  value,
  onChange,
  assessments = [],
  sources = [],
  allowNewAssessment = false,
}: {
  prefix: string;
  value?: SourceAuthorityContext;
  onChange: (value: SourceAuthorityContext | undefined) => void;
  assessments?: Assessment[];
  sources?: Source[];
  allowNewAssessment?: boolean;
}) {
  const update = (patch: Partial<SourceAuthorityContext>) => {
    if (value) onChange({ ...value, ...patch });
  };
  return (
    <details className="import-panel">
      <summary>Source role and assessment scope (optional)</summary>
      <p className="meta">
        Declare only what you have verified. A sender name or page title does not establish
        authority. Leave uncertain material unclassified.
      </p>
      <label className="field-label" htmlFor={`${prefix}-role`}>
        Verified source role
      </label>
      <select
        id={`${prefix}-role`}
        value={value?.role ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value
              ? {
                  role: event.target.value as SourceAuthorityContext['role'],
                  applicability: 'unknown',
                }
              : undefined,
          )
        }
      >
        <option value="">Unclassified</option>
        <option value="teaching-material">Teaching material</option>
        <option value="syllabus">Syllabus</option>
        <option value="instructor-update">Instructor update</option>
        <option value="returned-work">Returned work</option>
        <option value="student-question">Student question</option>
      </select>
      {value && (
        <>
          <label className="field-label" htmlFor={`${prefix}-scope`}>
            Applies to
          </label>
          <select
            id={`${prefix}-scope`}
            value={value.applicability ?? 'unknown'}
            onChange={(event) =>
              update({
                applicability: event.target.value as SourceAuthorityContext['applicability'],
                ...(event.target.value === 'course'
                  ? { assessmentId: undefined, confirmedFacts: undefined }
                  : {}),
              })
            }
          >
            <option value="unknown">Not yet verified</option>
            <option value="course">This course</option>
            <option value="assessment">One assessment</option>
            <option value="personal">A personal exception</option>
          </select>
          {['assessment', 'personal'].includes(value.applicability ?? '') && (
            <>
              <label className="field-label" htmlFor={`${prefix}-assessment`}>
                Assessment
              </label>
              {allowNewAssessment ? (
                <input
                  id={`${prefix}-assessment`}
                  value={value.assessmentId ?? ''}
                  pattern="[A-Za-z0-9_-]+"
                  maxLength={128}
                  onChange={(event) => update({ assessmentId: event.target.value || undefined })}
                  placeholder="midterm-1"
                />
              ) : (
                <select
                  id={`${prefix}-assessment`}
                  value={value.assessmentId ?? ''}
                  onChange={(event) =>
                    update({
                      assessmentId: event.target.value || undefined,
                      confirmedFacts: undefined,
                    })
                  }
                >
                  <option value="">Choose a registered assessment</option>
                  {assessments.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              )}
              {!allowNewAssessment && !assessments.length && (
                <p className="meta">
                  Register an assessment when importing its source material first.
                </p>
              )}
            </>
          )}
          <label className="field-label" htmlFor={`${prefix}-supersedes`}>
            Explicitly replaces these source versions (optional)
          </label>
          <select
            id={`${prefix}-supersedes`}
            multiple
            value={(value.supersedes ?? []).map((ref) => `${ref.sourceId}:${ref.version}`)}
            onChange={(event) =>
              update({
                supersedes: Array.from(event.target.selectedOptions, (option) => {
                  const source = sources.find(
                    (item) => `${item.id}:${item.version}` === option.value,
                  )!;
                  return { sourceId: source.id, version: source.version };
                }),
              })
            }
          >
            {sources.map((source) => (
              <option
                key={`${source.id}:${source.version}`}
                value={`${source.id}:${source.version}`}
              >
                {source.title} · v{source.version}
              </option>
            ))}
          </select>
          <p className="meta">
            Select a replacement only when the update explicitly corrects that version. A newer date
            alone is insufficient.
          </p>
          <label className="field-label" htmlFor={`${prefix}-impact`}>
            Change from the previous version
          </label>
          <select
            id={`${prefix}-impact`}
            value={value.changeImpact ?? 'content'}
            onChange={(event) =>
              update({ changeImpact: event.target.value as SourceAuthorityContext['changeImpact'] })
            }
          >
            <option value="content">Content changed or unknown</option>
            <option value="timing-only">Timing only; teaching content unchanged</option>
            <option value="no-effect">No change to the learning activity</option>
          </select>
          <p className="meta">
            Unchanged teaching passages are checked before reuse. Old source versions and attempts
            remain available.
          </p>
          {value.applicability === 'assessment' &&
            value.assessmentId &&
            ['instructor-update', 'syllabus'].includes(value.role) && (
              <details>
                <summary>Confirm assessment facts</summary>
                <p className="meta">
                  These values are your confirmation, not an inferred date or coverage claim. Paste
                  the exact supporting passage. Soma can propose applying them after reading it. For
                  a connection, every collected item must contain that passage; narrow the selection
                  to that specific update.
                </p>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={!!value.confirmedFacts?.deadline}
                    onChange={(event) =>
                      update({
                        confirmedFacts: {
                          ...value.confirmedFacts,
                          deadline: event.target.checked
                            ? { at: '', timezone: 'America/New_York', quote: '' }
                            : undefined,
                        },
                      })
                    }
                  />
                  Confirm a deadline
                </label>
                {value.confirmedFacts?.deadline && (
                  <>
                    <label className="field-label" htmlFor={`${prefix}-deadline`}>
                      Deadline with UTC offset
                    </label>
                    <input
                      id={`${prefix}-deadline`}
                      value={value.confirmedFacts.deadline.at}
                      placeholder="2026-11-04T21:00:00-05:00"
                      onChange={(event) =>
                        update({
                          confirmedFacts: {
                            ...value.confirmedFacts,
                            deadline: {
                              ...value.confirmedFacts!.deadline!,
                              at: event.target.value,
                            },
                          },
                        })
                      }
                    />
                    <label className="field-label" htmlFor={`${prefix}-timezone`}>
                      IANA timezone
                    </label>
                    <input
                      id={`${prefix}-timezone`}
                      value={value.confirmedFacts.deadline.timezone}
                      onChange={(event) =>
                        update({
                          confirmedFacts: {
                            ...value.confirmedFacts,
                            deadline: {
                              ...value.confirmedFacts!.deadline!,
                              timezone: event.target.value,
                            },
                          },
                        })
                      }
                    />
                    <label className="field-label" htmlFor={`${prefix}-deadline-quote`}>
                      Exact deadline passage
                    </label>
                    <textarea
                      id={`${prefix}-deadline-quote`}
                      rows={3}
                      maxLength={1000}
                      value={value.confirmedFacts.deadline.quote}
                      onChange={(event) =>
                        update({
                          confirmedFacts: {
                            ...value.confirmedFacts,
                            deadline: {
                              ...value.confirmedFacts!.deadline!,
                              quote: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </>
                )}
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={!!value.confirmedFacts?.coverage}
                    onChange={(event) =>
                      update({
                        confirmedFacts: {
                          ...value.confirmedFacts,
                          coverage: event.target.checked
                            ? { includedTopics: [], excludedTopics: [], quote: '' }
                            : undefined,
                        },
                      })
                    }
                  />
                  Confirm coverage
                </label>
                {value.confirmedFacts?.coverage && (
                  <>
                    <label className="field-label" htmlFor={`${prefix}-included`}>
                      Included topics (one per line)
                    </label>
                    <textarea
                      id={`${prefix}-included`}
                      rows={3}
                      value={value.confirmedFacts.coverage.includedTopics.join('\n')}
                      onChange={(event) =>
                        update({
                          confirmedFacts: {
                            ...value.confirmedFacts,
                            coverage: {
                              ...value.confirmedFacts!.coverage!,
                              includedTopics: event.target.value.split('\n'),
                            },
                          },
                        })
                      }
                    />
                    <label className="field-label" htmlFor={`${prefix}-excluded`}>
                      Excluded topics (one per line)
                    </label>
                    <textarea
                      id={`${prefix}-excluded`}
                      rows={3}
                      value={value.confirmedFacts.coverage.excludedTopics.join('\n')}
                      onChange={(event) =>
                        update({
                          confirmedFacts: {
                            ...value.confirmedFacts,
                            coverage: {
                              ...value.confirmedFacts!.coverage!,
                              excludedTopics: event.target.value.split('\n'),
                            },
                          },
                        })
                      }
                    />
                    <label className="field-label" htmlFor={`${prefix}-coverage-quote`}>
                      Exact coverage passage
                    </label>
                    <textarea
                      id={`${prefix}-coverage-quote`}
                      rows={3}
                      maxLength={1000}
                      value={value.confirmedFacts.coverage.quote}
                      onChange={(event) =>
                        update({
                          confirmedFacts: {
                            ...value.confirmedFacts,
                            coverage: {
                              ...value.confirmedFacts!.coverage!,
                              quote: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </>
                )}
              </details>
            )}
        </>
      )}
    </details>
  );
}
