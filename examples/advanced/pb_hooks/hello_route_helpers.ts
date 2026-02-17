export const buildHelloResponse = () => {
  return { message: "Hello from PocketBun hooks." };
};

export const logHelloRequestMiddleware = (requestEvent) => {
  console.log(`[hooks] ${requestEvent.request.method} ${requestEvent.request.url.path}`);
  return requestEvent.next();
};
