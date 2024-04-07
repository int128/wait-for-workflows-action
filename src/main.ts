import * as core from '@actions/core'
import * as github from '@actions/github'
import { run } from './run.js'

const main = async (): Promise<void> => {
  await run({
    initialDelaySeconds: Number.parseInt(core.getInput('initial-delay-seconds', { required: true })),
    periodSeconds: Number.parseInt(core.getInput('period-seconds', { required: true })),
    filterWorkflowEvents: core.getMultilineInput('filter-workflow-events'),
    excludeWorkflowNames: core.getMultilineInput('exclude-workflow-names'),
    filterWorkflowNames: core.getMultilineInput('filter-workflow-names'),
    sha: core.getInput('sha', { required: true }),
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    selfWorkflowName: github.context.workflow,
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
