export const buildHelloResponse = () => {
  return { message: "Hello from PocketBun hooks." };
};

export const logHelloRequestMiddleware = (requestEvent: core.RequestEvent) => {
  const requestMethod = requestEvent.request?.method ?? "UNKNOWN";
  const requestPath = requestEvent.request?.url?.path ?? "";
  console.log(`[hooks] ${requestMethod} ${requestPath}`);
  return requestEvent.next();
};
