import * as core from '@actions/core'
import { GitHub } from '@actions/github/lib/utils'
import { ActionsChecksQuery, ActionsChecksQueryVariables } from '../generated/graphql'
import assert from 'assert'
import { StatusState } from '../generated/graphql-types'

type Octokit = InstanceType<typeof GitHub>

const query = /* GraphQL */ `
  query actionsChecks($owner: String!, $name: String!, $oid: GitObjectID!, $appId: Int!, $afterCursor: String) {
    rateLimit {
      cost
    }
    repository(owner: $owner, name: $name) {
      object(oid: $oid) {
        __typename
        ... on Commit {
          statusCheckRollup {
            state
          }
          checkSuites(filterBy: { appId: $appId }, first: 100, after: $afterCursor) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              workflowRun {
                event
                workflow {
                  name
                }
              }
              status
              conclusion
            }
          }
        }
      }
    }
  }
`

export const withOctokit =
  (o: Octokit) =>
  async (v: ActionsChecksQueryVariables): Promise<ActionsChecksQuery> =>
    await o.graphql(query, v)

export const paginate = async (
  listChecks: (v: ActionsChecksQueryVariables) => Promise<ActionsChecksQuery>,
  v: ActionsChecksQueryVariables,
): Promise<ActionsChecksQuery> => {
  core.startGroup(`Query actionsChecks(${JSON.stringify(v)})`)
  const checks = await listChecks(v)
  core.debug(JSON.stringify(checks, undefined, 2))
  core.endGroup()

  assert(checks.repository != null)
  assert(checks.repository.object != null)
  assert(checks.repository.object.__typename === 'Commit')

  // Immediately return if the rollup status is failure, in order to reduce API calls
  assert(checks.repository.object.statusCheckRollup != null)
  if (checks.repository.object.statusCheckRollup.state === StatusState.Failure) {
    return checks
  }

  assert(checks.repository.object.checkSuites != null)
  if (!checks.repository.object.checkSuites.pageInfo.hasNextPage) {
    return checks
  }

  const next = await paginate(listChecks, {
    ...v,
    afterCursor: checks.repository.object.checkSuites.pageInfo.endCursor,
  })
  assert(next.repository != null)
  assert(next.repository.object != null)
  assert(next.repository.object.__typename === 'Commit')
  assert(next.repository.object.checkSuites != null)
  assert(next.repository.object.checkSuites.nodes != null)

  assert(checks.repository.object.checkSuites.nodes != null)
  next.repository.object.checkSuites.nodes = [
    ...checks.repository.object.checkSuites.nodes,
    ...next.repository.object.checkSuites.nodes,
  ]
  return next
}
