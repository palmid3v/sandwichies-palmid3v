# Data Connect Status

**Status:** Experimental / non-production.

## Decision

The active Sandwichies order architecture is:

- React/Vite browser client
- Firebase Authentication
- Firebase callable Functions
- Firestore

The files under `app/dataconnect/` define a separate PostgreSQL/Firebase Data Connect model and are not used by the current customer ordering or admin order flows.

## Rule

Do not introduce Data Connect into the production order path without:

1. an explicit architecture decision,
2. a migration/data ownership plan,
3. security and authorization validation,
4. updated tests,
5. updated deployment documentation,
6. an explicit roadmap item.

Until then, preserve the files as experimental/legacy material rather than silently deleting them.
