# Domain-driven design
Features are split in modules: `app/modules/habits` for example.
Then, it’s further split into infra, domain, and application.

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
