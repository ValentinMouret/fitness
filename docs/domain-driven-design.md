# Domain-driven design
Features are split in modules: `app/modules/habits` for example.
Then, it’s further split into infra, domain, and application.

Dependency direction is strict:
- `domain` is pure and cannot import `application` or `infra`
- `application` can import `domain`, but cannot import `infra`
- `infra` adapts external systems and may depend on `application` and `domain`

## Parse at boundaries

Parse and validate untrusted data where it enters the application: HTML form
adapters, route parameters, MCP handlers, imports, and external API responses.
Use Zod to produce typed values, including defaults and transport conversions,
before calling application operations.

Application operations and repositories must accept explicit, readonly input
types. They must not accept `unknown`, raw `FormData`, or serialized request
bodies and parse them internally. Do not cast untrusted values into those types.
Shared schemas may define the input contract; execute them at the boundary.

Domain and application code still enforce business invariants, such as valid
workout times, exercise membership, and preserving completed sets. Return those
failures through `neverthrow`; the boundary translates them into a response.

We also follow react-router convention of having client-only files end with `.client.ts(x)` and server-only files end with `.server.ts`.

Domain code is shared by the frontend and backend, so it should only be made of `.ts` files.

A module might look like:
```
|- app
   |- modules
      |- habits
         |- infra
            |- repository.server.ts
         |- domain
            |- entity.ts
            |- application
               |- service.ts
```
