import { CheckAnnotationLevel } from './generated/graphql-types.js'
import type { WorkflowRunAnnotationsQuery } from './queries/workflowRunAnnotations.js'

export type AnnotatedWorkflowRun = {
  id: string
  failureAnnotationMessages: string[]
}

export const getAnnotatedWorkflowRuns = (query: WorkflowRunAnnotationsQuery): AnnotatedWorkflowRun[] =>
  Object.values(query).map((fragment) => {
    const failureAnnotationMessageSet = new Set<string>()
    for (const checkRunNode of fragment.checkSuite.checkRuns?.nodes ?? []) {
      for (const annotationNode of checkRunNode?.annotations?.nodes ?? []) {
        if (annotationNode?.annotationLevel === CheckAnnotationLevel.Failure) {
          failureAnnotationMessageSet.add(annotationNode.message)
        }
      }
    }
    return {
      id: fragment.id,
      failureAnnotationMessages: [...failureAnnotationMessageSet],
    }
  })
