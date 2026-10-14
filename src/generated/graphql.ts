/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import * as Types from './graphql-types.js';

/** Represents an annotation's information level. */
export type CheckAnnotationLevel =
  /** An annotation indicating an inescapable error. */
  | 'FAILURE'
  /** An annotation indicating some information. */
  | 'NOTICE'
  /** An annotation indicating an ignorable error. */
  | 'WARNING';

/** The possible states for a check suite or run conclusion. */
export type CheckConclusionState =
  /** The check suite or run requires action. */
  | 'ACTION_REQUIRED'
  /** The check suite or run has been cancelled. */
  | 'CANCELLED'
  /** The check suite or run has failed. */
  | 'FAILURE'
  /** The check suite or run was neutral. */
  | 'NEUTRAL'
  /** The check suite or run was skipped. */
  | 'SKIPPED'
  /** The check suite or run was marked stale by GitHub. Only GitHub can use this conclusion. */
  | 'STALE'
  /** The check suite or run has failed at startup. */
  | 'STARTUP_FAILURE'
  /** The check suite or run has succeeded. */
  | 'SUCCESS'
  /** The check suite or run has timed out. */
  | 'TIMED_OUT';

/** The possible states for a check suite or run status. */
export type CheckStatusState =
  /** The check suite or run has been completed. */
  | 'COMPLETED'
  /** The check suite or run is in progress. */
  | 'IN_PROGRESS'
  /** The check suite or run is in pending state. */
  | 'PENDING'
  /** The check suite or run has been queued. */
  | 'QUEUED'
  /** The check suite or run has been requested. */
  | 'REQUESTED'
  /** The check suite or run is in waiting state. */
  | 'WAITING';

export type WorkflowRunAnnotationsFragment = { id: string, checkSuite: { checkRuns: { nodes: Array<{ annotations: { nodes: Array<{ annotationLevel: Types.CheckAnnotationLevel | null, message: string } | null> | null } | null } | null> | null } | null } };

export type WorkflowRunsForCommitQueryVariables = Exact<{
  owner: string;
  name: string;
  oid: unknown;
  appId: number;
  firstCheckSuite: number;
  afterCheckSuite?: string | null | undefined;
}>;


export type WorkflowRunsForCommitQuery = { rateLimit: { cost: number, remaining: number } | null, repository: { object:
      | { __typename: 'Blob' }
      | { __typename: 'Commit', checkSuites: { totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string | null }, nodes: Array<{ status: Types.CheckStatusState, conclusion: Types.CheckConclusionState | null, workflowRun: { id: string, event: string, url: string, createdAt: string, updatedAt: string, workflow: { name: string }, file: { path: string } | null } | null } | null> | null } | null }
      | { __typename: 'Tag' }
      | { __typename: 'Tree' }
     | null } | null };
