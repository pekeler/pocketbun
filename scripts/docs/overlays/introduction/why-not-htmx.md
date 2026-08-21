### Why not htmx, Hotwire/Turbo, Unpoly, etc.

htmx, Hotwire/Turbo, Unpoly and other similar tools are commonly used for building server rendered applications but unfortunately they don't play well with the JSON APIs and fully stateless nature of PocketBun.

It is possible to use them with PocketBun but at the moment I don't recommend it because we lack the necessary helpers and utilities for building SSR-first applications, which means that you might have to create a lot of things on your own such as middlewares for handling cookies or custom authentication endpoints and access controls (\*the collection API rules apply only for the builtin JSON routes). Bun's native `Bun.CSRF.generate(...)` / `Bun.CSRF.verify(...)` helpers can reduce the CSRF part of that work for Bun-native custom endpoints. For cookie-authenticated forms, pass the same stable per-session `sessionId` when generating and verifying each token. PocketBun still doesn't ship a built-in SSR middleware stack.

In the future we could eventually provide official SSR support in terms of guides and middlewares for this use case but again - PocketBun wasn't designed with this in mind and you may want to reevaluate the tech stack of your application and switch to a traditional client-side SPA as mentioned earlier or use a different backend solution that might fit better with your use case.
