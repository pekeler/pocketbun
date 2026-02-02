// Ported from pocketbase/tests/request.go

import { randomString } from "../tools/security/random.ts";

export async function MockMultipartData(
  data: Record<string, string>,
  ...fileFields: string[]
): Promise<{ body: Uint8Array; contentType: string }> {
  const form = new FormData();

  for (const [key, value] of Object.entries(data)) {
    form.append(key, value);
  }

  for (const fileField of fileFields) {
    const name = `tmpfile-${randomString(8)}.txt`;
    const file = new File([new TextEncoder().encode("test")], name);
    form.append(fileField, file);
  }

  const req = new Request("http://localhost", { method: "POST", body: form });
  const contentType = req.headers.get("content-type") ?? "";
  const body = new Uint8Array(await req.arrayBuffer());

  return { body, contentType };
}
