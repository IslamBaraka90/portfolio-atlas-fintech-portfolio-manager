# Fastify HTTP boundary and dependency composition

The API validates incoming contracts, calls core use cases, and maps typed outcomes to HTTP. It owns process configuration and wiring. Financial calculations belong in core or analytics adapters; Yahoo calls belong in the provider adapter.

Chapter 1 is implemented: Fastify validates contracts, invokes versioned mandate use cases and returns findings with session metadata. Start through the root development command. See the [HTTP reference](../../docs/chapters/01-http-reference.md).

See the [chapter plans](../../PRPs/README.md) and [architecture](../../docs/architecture/README.md).
