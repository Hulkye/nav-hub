export const submissionDraftKey = 'navhub.submission-draft.v1'
export type SubmissionDraft = { title: string; url: string; description: string; submitterName: string }

export function submissionDraft(value: unknown): SubmissionDraft {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const field = (key: string, limit: number) => typeof input[key] === 'string' ? input[key].slice(0, limit) : ''
  return { title: field('title', 160), url: field('url', 2048), description: field('description', 2000), submitterName: field('submitterName', 80) }
}
