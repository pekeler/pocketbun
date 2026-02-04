import PocketBase from "pocketbase";

const baseUrl = process.env.POCKETBUN_BASE_URL ?? "http://127.0.0.1:8090";
const pb = new PocketBase(baseUrl);

const health = await pb.health.check();
console.log("health", health);

const email = process.env.POCKETBUN_DEMO_EMAIL ?? "";
const password = process.env.POCKETBUN_DEMO_PASSWORD ?? "";

if (email && password) {
  const auth = await pb.collection("users").authWithPassword(email, password);
  console.log("auth", { id: auth.record?.id, token: auth.token ? "<redacted>" : "" });

  const projects = await pb.collection("projects").getList(1, 5);
  console.log("projects", projects.items.length);
}
