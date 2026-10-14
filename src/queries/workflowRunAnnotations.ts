import type { Octokit } from '@octokit/action'
import type { WorkflowRunAnnotationsQuery, WorkflowRunAnnotationsQueryVariables } from '../generated/graphql.js'

const query = /* GraphQL */ `
  query workflowRunAnnotations(
    $workflowRunId: ID!
  ) {
    node(id: $workflowRunId) {
      ... on WorkflowRun {
        checkSuite {
          checkRuns(first: 100) {
            nodes {
              annotations(first: 10) {
                nodes {
                  annotationLevel
                  message
                }
              }
            }
          }
        }
      }
    }
  }
`

export const executeWorkflowRunAnnotationsQuery = async (octokit: Octokit, v: WorkflowRunAnnotationsQueryVariables) =>
  await octokit.graphql<WorkflowRunAnnotationsQuery>(query, v)
