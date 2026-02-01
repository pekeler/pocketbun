// Ported from pocketbase/tools/subscriptions/message.go

export type MessageWriter = {
  write: (chunk: string | Uint8Array) => void;
};

export class Message {
  Name: string;
  Data: Uint8Array;

  constructor(name = "", data: Uint8Array | string = new Uint8Array()) {
    this.Name = name;
    this.Data = typeof data === "string" ? new TextEncoder().encode(data) : data;
  }

  WriteSSE(writer: MessageWriter, eventId: string): void {
    writer.write(`id:${eventId}\n`);
    writer.write(`event:${this.Name}\n`);
    writer.write("data:");
    writer.write(this.Data);
    writer.write("\n\n");
  }
}
