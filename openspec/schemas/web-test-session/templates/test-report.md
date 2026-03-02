# Test Report

## Session Info

- **Project**: {{projectName}}
- **Session ID**: {{sessionId}}
- **Change Name**: {{change-name}}
- **Date**: {{date}}
- **Playwright Command**: {{playwrightCommand}}
- **Base URL**: {{baseURL}}

## Test Results

- **Total Tests**: {{totalTests}}
- **Passed**: {{passedCount}}
- **Failed**: {{failedCount}}
- **JSON Report Path**: {{jsonReportPath}}

## Failed Tests

{{#each failures}}
### {{testName}}

- **File**: {{filePath}}
- **Line**: {{line}}
- **Error**: {{errorMessage}}

{{/each}}

## Evidence

- **Checkpoint Path**: `projects/{{projectName}}/sessions/checkpoints/{{sessionId}}.json`
- **Knowledge Files**:
{{#each knowledgeFiles}}
  - `{{this}}`
{{/each}}

## Next Steps

1. Review failed tests above
2. Implement fixes using TDD approach
3. Record fix attempts in fix-log.md
4. Update task checklist in tasks.md
