# Backend contracts

One file per feature whose server doesn't exist yet. Each file is the
complete wire contract for that feature — endpoints, request/response
shapes, auth, error conventions — written so a session building the backend
can implement against it directly, without reading the client design
rationale that produced it.

The full design (why, client architecture, what's explicitly out of scope)
lives in the matching file under `docs/superpowers/specs/`, which links back
here for its contract section rather than duplicating it.

| Feature | Contract | Design spec |
|---|---|---|
| Email/password auth | [`auth.md`](./auth.md) | none — documents an already-shipped client |
| AI chat | [`ai-chat.md`](./ai-chat.md) | [`2026-09-19-ai-chat-design.md`](../superpowers/specs/2026-09-19-ai-chat-design.md) |
| Social sign-in | [`social-sign-in.md`](./social-sign-in.md) | [`2026-09-19-social-sign-in-design.md`](../superpowers/specs/2026-09-19-social-sign-in-design.md) |
| AI food capture | [`ai-food-capture.md`](./ai-food-capture.md) | none — small enough to document directly in the contract |
| Premium entitlements | [`premium-entitlements.md`](./premium-entitlements.md) | none — small enough to document directly in the contract |
| Diary/log sync (pull + push) | [`sync.md`](./sync.md) | none — the design is `CLAUDE.md`'s local-first section and `src/data/sync.ts`'s own doc comment |

If a contract changes after the client is built against it, the change
starts here, then flows back to a client-side update — never a silent
divergence between what this file says and what the client actually sends.
