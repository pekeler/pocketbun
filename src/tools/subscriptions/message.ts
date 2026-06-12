// Ported from pocketbase/tools/subscriptions/message.go

export type MessageWriter = {
  write: (chunk: string | Uint8Array) => void;
};

// Message defines a client's channel data.
export class Message {
  Name: string;
  Data: Uint8Array;

  constructor(name = "", data: Uint8Array | string = new Uint8Array()) {
    this.Name = name;
    this.Data = typeof data === "string" ? new TextEncoder().encode(data) : data;
  }

  get name(): string {
    return this.Name;
  }

  set name(value: string) {
    this.Name = value;
  }

  get data(): Uint8Array {
    return this.Data;
  }

  set data(value: Uint8Array | string) {
    this.Data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  }

  // WriteSSE writes the current message in a SSE format into the provided writer.
  //
  // For example, writing to a router.Event:
  //
  //	m := Message{Name: "users/create", Data: []byte{...}}
  //	m.WriteSSE(e.Response, "yourEventId")
  //	e.Flush()
  WriteSSE(writer: MessageWriter, eventId: string): void {
    writer.write(`id:${eventId}\n`);
    writer.write(`event:${this.Name}\n`);
    writer.write("data:");
    writer.write(this.Data);
    writer.write("\n\n");
  }

  // writeSSE is a JSVM compatibility alias for WriteSSE.
  writeSSE(writer: MessageWriter, eventId: string): void {
    this.WriteSSE(writer, eventId);
  }
}
