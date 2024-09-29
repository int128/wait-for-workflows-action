import * as core from '@actions/core'
import * as github from '@actions/github'
import { run } from './run.js'

const main = async (): Promise<void> => {
  await run({
    filterWorkflowNames: core.getMultilineInput('filter-workflow-names'),
    excludeWorkflowNames: core.getMultilineInput('exclude-workflow-names'),
    filterWorkflowEvents: core.getMultilineInput('filter-workflow-events'),
    initialDelaySeconds: Number.parseInt(core.getInput('initial-delay-seconds', { required: true })),
    periodSeconds: Number.parseInt(core.getInput('period-seconds', { required: true })),
    pageSizeOfCheckSuites: parseInt(core.getInput('page-size-of-check-suites', { required: true })),
    sha: core.getInput('sha', { required: true }),
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    selfWorkflowName: github.context.workflow,
    selfWorkflowURL: `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
