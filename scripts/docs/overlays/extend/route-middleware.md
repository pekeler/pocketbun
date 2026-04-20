#### Route middleware with reusable handlers

To keep middleware reusable, define it once and pass it as an extra `routerAdd(...)` argument:

```ts
const requireTraceIdMiddleware = (requestEvent) => {
  if (requestEvent.request.header.get("x-trace-id") === "") {
    return requestEvent.json(400, { error: "Missing x-trace-id header." });
  }
  return requestEvent.next();
};

routerAdd(
  "GET",
  "/hello",
  (requestEvent) => {
    return requestEvent.json(200, { message: "Hello!" });
  },
  requireTraceIdMiddleware,
);
```
