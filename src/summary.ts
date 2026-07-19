import * as core from '@actions/core'
import type { Rollup } from './checks.js'
import { formatConclusion, formatStatus, isFailedConclusion } from './checks.js'
import { CheckConclusionState } from './generated/graphql-types.js'

export const writeWorkflowRunsSummary = async (rollup: Rollup) => {
  core.summary.addHeading('wait-for-workflows summary', 2)
  core.summary.addRaw('<p>Rollup conclusion: ')
  core.summary.addRaw(formatConclusion(rollup.conclusion))
  core.summary.addRaw('</p>')
  core.summary.addCodeBlock(generateTimeline(rollup), 'mermaid')
  core.summary.addTable([
    [
      { data: 'Workflow run', header: true },
      { data: 'Status', header: true },
      { data: 'Conclusion', header: true },
    ],
    ...rollup.workflowRuns.map((run) => [
      { data: `<a href="${run.url}">${run.workflowName} (${run.event})</a>` },
      { data: formatStatus(run.status) },
      { data: formatConclusion(run.conclusion) },
    ]),
  ])
  await core.summary.write()
}

const generateTimeline = (rollup: Rollup): string => {
  const lines = ['gantt', 'dateFormat YYYY-MM-DDTHH:mm:ssZ', 'axisFormat %H:%M:%S']
  for (const run of rollup.workflowRuns) {
    const start = run.createdAt.toISOString()
    const seconds = (run.updatedAt.getTime() - run.createdAt.getTime()) / 1000
    let tag = ''
    if (isFailedConclusion(run.conclusion)) {
      tag = 'crit'
    } else if (run.conclusion === CheckConclusionState.Skipped) {
      tag = 'done'
    }
    lines.push(
      `section ${run.workflowName}`,
      `${formatStatus(run.status)} ${formatConclusion(run.conclusion)} :${tag}, ${start}, ${seconds}s`,
    )
  }
  return lines.join('\n')
}
