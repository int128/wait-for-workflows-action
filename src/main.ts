import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    sha: core.getInput('sha', { required: true }),
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
