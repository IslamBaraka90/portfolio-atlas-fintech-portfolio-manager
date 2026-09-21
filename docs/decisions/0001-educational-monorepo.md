# ADR 0001 — Educational TypeScript monorepo

Status: accepted for the planning foundation.

Use npm workspaces, a Fastify API, a React/Vite frontend, and independent contracts, core, adapters, and testing packages. This makes financial rules inspectable while keeping one lockfile and one chapter history.

The core remains independent of transport, provider, and persistence details. Dependency injection is explicit at the API composition boundary. Avoid dependency-injection containers and distributed services until a demonstrated requirement justifies them.

Choose strict TypeScript now. Add application entry points, runtime scripts, exports, and behavior tests in Chapter 1. Config files alone do not constitute a running app.

Tradeoff: several workspace packages introduce build/export decisions. Chapter 1 must implement and test those boundaries in a fresh install, and ensure frontend imports do not pull server clients into the browser.
