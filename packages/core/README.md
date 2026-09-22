# Financial domain, use cases, and ports

The domain will hold financial rules and invariants; application use cases coordinate them; ports describe dependencies. This package must remain independent of Fastify, React, Yahoo, and database clients.

Chapter 1 is implemented: pure allocation rules, versioned mandate use cases, repository ports, clock and ID interfaces. Core imports contracts only; it does not import HTTP, storage implementations or vendor clients.

See the [chapter plans](../../PRPs/README.md) and [architecture](../../docs/architecture/README.md).
