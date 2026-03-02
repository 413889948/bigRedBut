# Fix Log

## Session Info

- **Project**: {{projectName}}
- **Session ID**: {{sessionId}}
- **Change Name**: {{change-name}}

## Failures Addressed

{{#each failures}}
- [ ] {{testName}} ({{filePath}}:{{line}})

{{/each}}

## TDD Attempts

{{#each tddAttempts}}
### Attempt {{attemptNumber}}: {{failureName}}

**Status**: {{status}}

**Files Changed**:
{{#each filesChanged}}
- `{{this}}`

{{/each}}
**Verification Command**:
```bash
{{verificationCommand}}
```

**Result**: {{result}}

{{#if !success}}
**Failure Reason**: {{failureReason}}

{{/if}}
{{/each}}

## Summary

- **Total Attempts**: {{totalAttempts}}
- **Successful**: {{successfulAttempts}}
- **Failed**: {{failedAttempts}}
- **Success Rate**: {{successRate}}%

## Remaining Failures

{{#each remainingFailures}}
- [ ] {{testName}}

{{/each}}

## Files Modified

{{#each allFilesModified}}
- `{{this}}`

{{/each}}
## Verification Commands

{{#each verificationCommands}}
```bash
{{this}}
```

{{/each}}
