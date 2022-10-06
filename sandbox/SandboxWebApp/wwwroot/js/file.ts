﻿
export function bar() {
    alert("bar!");
}

export async function hoge() {
    var f = new Foo();
    f.age = null;
    f.name = "hogemoge";

    var bin = Foo.serialize(f);

    var blob = new Blob([bin.buffer], { type: "application/x-memorypack" })

    var v = await fetch("http://localhost:5260/api", { method: "POST", body: blob, headers: { "Content-Type": "application/x-memorypack" } });



    var buffer = await v.arrayBuffer();

    var foo = Foo.deserialize(buffer);
}


export class Foo {
    age: number
    name: string

    public constructor() {
    }

    static serialize(value: Foo): Uint8Array {
        let writer = MemoryPackWriter.getInstance();
        this.serializeCore(writer, value);
        return writer.toArray();
    }

    static serializeCore(writer: MemoryPackWriter, value: Foo): void {
        writer.writeObjectHeader(2);
        writer.writeInt32(value.age);
        writer.writeString(value.name);
    }

    static deserialize(buffer: ArrayBuffer): Foo {
        return this.deserializeCore(new MemoryPackReader(buffer));
    }

    static deserializeCore(reader: MemoryPackReader): Foo {
        let memberCount = reader.readObjectHeader();

        var value = new Foo();
        value.age = reader.readInt32();

        return value;
    }
}



export class MemoryPackWriter {
    // pooled writer
    static singletonWriter: MemoryPackWriter;

    public static getInstance(): MemoryPackWriter {
        if (this.singletonWriter == null) {
            this.singletonWriter = new MemoryPackWriter();
        }
        this.singletonWriter.clear();
        return this.singletonWriter;
    }

    private buffer: Uint8Array
    private dataView: DataView;
    private utf8Encoder: TextEncoder;
    private offset: number
    // TODO: depth

    public constructor(initialCapacity: number = 256) {
        this.buffer = new Uint8Array(initialCapacity);
        this.dataView = new DataView(this.buffer.buffer);
        this.utf8Encoder = new TextEncoder();
        this.offset = 0;
    }

    private ensureCapacity(count: number) {
        if (this.buffer.length - this.offset < count) {
            var nextCapacity = this.buffer.length;
            var to = this.offset + count;

            while (nextCapacity < to) {
                nextCapacity = nextCapacity * 2;
            }

            var nextBuffer = new Uint8Array(nextCapacity);
            nextBuffer.set(this.buffer);

            this.buffer = nextBuffer;
            this.dataView = new DataView(this.buffer.buffer);
        }
    }

    public writeNullObjectHeader(): void {
        this.writeUint8(255);
    }

    public writeObjectHeader(memberCount: number) {
        this.writeUint8(memberCount);
    }

    // TODO: PRIMITIVES

    public writeUint8(value: number): void {
        this.ensureCapacity(1);
        this.dataView.setUint8(this.offset, value);
        this.offset += 1;
    }

    public writeInt32(value: number): void {
        this.ensureCapacity(4);
        this.dataView.setInt32(this.offset, value, true);
        this.offset += 4;
    }

    public writeString(value: string): void {
        if (value == null) {
            this.writeNullObjectHeader();
            return;
        }

        // [utf8-length, utf16-length, utf8-value]
        this.ensureCapacity(8 + ((value.length + 1) * 3));

        var encodeResult = this.utf8Encoder.encodeInto(value, this.buffer.subarray(this.offset + 8));
        this.dataView.setInt32(this.offset, ~encodeResult.written, true);
        this.dataView.setInt32(this.offset + 4, encodeResult.read, true);

        this.offset += (encodeResult.written + 8);
    }

    // TODO: ARRAY
    // TODO: UNION
    // TODO: GUID
    // TODO: Date

    public clear(): void {
        this.offset = 0;
    }

    public getSpan(): Uint8Array {
        return this.buffer.subarray(0, this.offset);
    }

    public toArray(): Uint8Array {
        return this.buffer.slice(0, this.offset);
    }
}

export class MemoryPackReader {
    private buffer: ArrayBuffer
    private dataView: DataView
    private offset: number

    public constructor(buffer: ArrayBuffer) {
        this.buffer = buffer;
        this.dataView = new DataView(this.buffer);
        this.offset = 0;
    }

    public readObjectHeader(): number {
        return this.readInt32();
    }

    public readInt32(): number {
        var v = this.dataView.getInt32(this.offset, true);
        this.offset += 4;
        return v;
    }
}
