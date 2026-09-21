# Fastify HTTP boundary and dependency composition

The API will validate incoming contracts, call core use cases, and map typed outcomes to HTTP. It owns process configuration and wiring. Financial calculations belong in core or analytics adapters; Yahoo calls belong in the provider adapter.

Status: structure and dependencies only. No application implementation exists yet.

See the [chapter plans](../../PRPs/README.md) and [architecture](../../docs/architecture/README.md).
