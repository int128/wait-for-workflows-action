import * as core from '@actions/core'
import { getContext, getOctokit } from './github.js'
import { run } from './run.js'

const main = async (): Promise<void> => {
  const context = await getContext()
  const outputs = await run(
    {
      filterWorkflowNames: core.getMultilineInput('filter-workflow-names'),
      excludeWorkflowNames: core.getMultilineInput('exclude-workflow-names'),
      filterWorkflowEvents: core.getMultilineInput('filter-workflow-events'),
      failFast: core.getBooleanInput('fail-fast', { required: true }),
      initialDelaySeconds: Number.parseInt(core.getInput('initial-delay-seconds', { required: true }), 10),
      periodSeconds: Number.parseInt(core.getInput('period-seconds', { required: true }), 10),
      pageSizeOfCheckSuites: parseInt(core.getInput('page-size-of-check-suites', { required: true }), 10),
      sha: core.getInput('sha', { required: true }),
      selfWorkflowName: context.workflow,
      selfWorkflowURL: `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
    },
    getOctokit(),
    context,
  )

  if (outputs.rollupState) {
    core.setOutput('rollup-state', outputs.rollupState)
  }
  core.setOutput('failed-workflow-names', outputs.failedWorkflowNames.join('\n'))

  core.startGroup('outputs')
  core.info(JSON.stringify(outputs, undefined, 2))
  core.endGroup()
}

await main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
