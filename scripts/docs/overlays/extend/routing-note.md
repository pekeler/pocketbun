If your custom routes introduce cookie-backed sessions or server-rendered forms, Bun's native `Bun.CSRF.generate(...)` / `Bun.CSRF.verify(...)` helpers can be a useful building block. When an authenticated session exists, bind the token to its stable per-session identifier (not merely the user or record ID) by passing the same `sessionId` during generation and verification:

```js
const token = Bun.CSRF.generate(csrfSecret, { sessionId: session.id });
const valid = Bun.CSRF.verify(submittedToken, { secret: csrfSecret, sessionId: session.id });
```

Keep `csrfSecret` outside source control. PocketBun's builtin JSON APIs remain stateless and don't manage CSRF tokens for your custom route layer.
