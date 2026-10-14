import assert from 'node:assert'
import { CheckAnnotationLevel } from './generated/graphql-types.js'
import type { WorkflowRunAnnotationsQuery } from './queries/workflowRunAnnotations.js'

export type AnnotatedWorkflowRun = {
  id: string
  failureAnnotationMessages: string[]
}

export const getAnnotatedWorkflowRuns = (query: WorkflowRunAnnotationsQuery): AnnotatedWorkflowRun[] =>
  Object.values(query).map((fragment) => {
    const failureAnnotationMessageSet = new Set<string>()
    assert(fragment.checkSuite.checkRuns != null, `checkSuite.checkRuns must not be null`)
    assert(fragment.checkSuite.checkRuns.nodes != null, `checkSuite.checkRuns.nodes must not be null`)
    for (const checkRunNode of fragment.checkSuite.checkRuns.nodes) {
      assert(checkRunNode != null, `checkRunNode must not be null`)
      assert(checkRunNode.annotations != null, `checkRunNode.annotations must not be null`)
      assert(checkRunNode.annotations.nodes != null, `checkRunNode.annotations.nodes must not be null`)
      for (const annotationNode of checkRunNode.annotations.nodes) {
        assert(annotationNode != null, `annotationNode must not be null`)
        if (annotationNode.annotationLevel === CheckAnnotationLevel.Failure) {
          failureAnnotationMessageSet.add(annotationNode.message)
        }
      }
    }
    return {
      id: fragment.id,
      failureAnnotationMessages: [...failureAnnotationMessageSet],
    }
  })
