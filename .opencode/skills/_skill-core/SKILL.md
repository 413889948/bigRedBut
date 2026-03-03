---
name: _skill-core
description: Internal shared runtime for web-tester and web-developer. Provides execution context, checkpoint persistence, validation, and session management.
license: MIT
compatibility: Node.js 20+; TypeScript runtime via tsx/node.
metadata:
  author: user
  version: "1.0"
---

## Purpose

This internal skill packages the shared runtime modules used by:
- `web-tester`
- `web-developer`

It is not intended to be called directly by users.

## Modules

- `src/execution-context.ts`
- `src/checkpoint-validator.ts`
- `src/checkpoint.ts`
- `src/session-manager.ts`
- `src/index.ts` (barrel exports)

## Dependency Rule

Other skills import shared utilities from `../_skill-core/src/*` to avoid depending on repository-root `src/` layout.
