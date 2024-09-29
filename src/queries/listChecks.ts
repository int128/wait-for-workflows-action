import assert from 'assert'
import * as core from '@actions/core'
import { ListChecksQuery, ListChecksQueryVariables } from '../generated/graphql.js'
import { Octokit } from '../github.js'

const query = /* GraphQL */ `
  query listChecks(
    $owner: String!
    $name: String!
    $oid: GitObjectID!
    $appId: Int!
    $firstCheckSuite: Int!
    $afterCheckSuite: String
  ) {
    rateLimit {
      cost
      remaining
    }
    repository(owner: $owner, name: $name) {
      object(oid: $oid) {
        __typename
        ... on Commit {
          checkSuites(filterBy: { appId: $appId }, first: $firstCheckSuite, after: $afterCheckSuite) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              workflowRun {
                event
                url
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

type QueryFunction = (v: ListChecksQueryVariables) => Promise<ListChecksQuery>

const createQueryFunction =
  (octokit: Octokit): QueryFunction =>
  async (v: ListChecksQueryVariables): Promise<ListChecksQuery> =>
    core.group(`ListChecksQuery`, async () => {
      core.info(JSON.stringify(v))
      const q: ListChecksQuery = await octokit.graphql(query, v)
      assert(q.rateLimit != null)
      core.info(`rateLimit.cost: ${q.rateLimit.cost}`)
      core.info(`rateLimit.remaining: ${q.rateLimit.remaining}`)
      core.debug(JSON.stringify(q, undefined, 2))
      return q
    })

export const getListChecksQuery = async (octokit: Octokit, v: ListChecksQueryVariables): Promise<ListChecksQuery> => {
  const fn = createQueryFunction(octokit)
  const q = await fn(v)
  const checkSuites = getCheckSuites(q)
  await paginateCheckSuites(fn, v, checkSuites)
  return q
}

const paginateCheckSuites = async (
  fn: QueryFunction,
  v: ListChecksQueryVariables,
  cumulativeCheckSuites: CheckSuites,
): Promise<void> => {
  assert(cumulativeCheckSuites.nodes != null)
  while (cumulativeCheckSuites.pageInfo.hasNextPage) {
    const nextQuery = await fn({
      ...v,
      afterCheckSuite: cumulativeCheckSuites.pageInfo.endCursor,
    })
    const nextCheckSuites = getCheckSuites(nextQuery)
    assert(nextCheckSuites.nodes != null)
    cumulativeCheckSuites.nodes.push(...nextCheckSuites.nodes)
    cumulativeCheckSuites.totalCount = nextCheckSuites.totalCount
    cumulativeCheckSuites.pageInfo = nextCheckSuites.pageInfo
    core.info(`Fetched ${cumulativeCheckSuites.nodes.length} of ${cumulativeCheckSuites.totalCount} CheckSuites`)
  }
}

type CheckSuites = ReturnType<typeof getCheckSuites>

const getCheckSuites = (q: ListChecksQuery) => {
  assert(q.repository != null)
  assert(q.repository.object != null)
  assert.strictEqual(q.repository.object.__typename, 'Commit')
  assert(q.repository.object.checkSuites != null)
  return q.repository.object.checkSuites
}
