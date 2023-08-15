# wait-for-workflows-action [![ts](https://github.com/int128/wait-for-workflows-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/wait-for-workflows-action/actions/workflows/ts.yaml)

This is an action to wait for all workflow runs of the current SHA.
It is useful to set up a branch protection rule with the status check.

## Getting Started

To wait for all workflow runs of the current pull request,

```yaml
name: wait-for-workflows

on:
  pull_request:

jobs:
  wait-for-workflows:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: int128/wait-for-workflows-action@v1
```

### Inputs

| Name                    | Default | Description                  |
| ----------------------- | ------- | ---------------------------- |
| `initial-delay-seconds` | 10      | Initial delay before polling |
| `period-seconds`        | 15      | Polling period               |

### Outputs

None.
