---
name: api-client
description: >
  Generate typed API client code from OpenAPI/Swagger specs.
  Supports TypeScript and Python output. Handles auth headers,
  pagination, and error responses.
  Not for: GraphQL, gRPC, or WebSocket APIs.
---

# API Client Generator

## Prerequisites

- OpenAPI 3.0+ or Swagger 2.0 spec file (JSON or YAML)

## How to use

### Step 1: Load spec

Read the OpenAPI spec file. Validate it has `paths` and `components`.

### Step 2: Generate client

For each endpoint in `paths`, generate a typed function:

- Method name from `operationId` (or `method + path` if missing)
- Request params typed from `parameters` and `requestBody`
- Response typed from `responses.200.content`
- Add auth header injection from spec's `securitySchemes`

### Step 3: Handle pagination

If response has `next` link or `offset/limit` params, generate a paginated variant that auto-fetches all pages.

### Step 4: Error handling

Generate typed error classes from non-2xx responses in spec.

### Step 5: Write output

Write generated code to user-specified directory.

## Output Format

```
Generated: <count> endpoint functions
Auth: <scheme_type>
Pagination: <count> paginated endpoints
Errors: <count> error types
Output: <directory>
```

## Edge Cases

- Missing operationId: derive from method + path
- Circular $ref: detect and warn, generate partial types
- Large specs (>100 endpoints): ask user to filter by tag
