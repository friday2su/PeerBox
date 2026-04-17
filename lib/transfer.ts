export const CHUNK_SIZE = 64 * 1024;

export type FileHeader = {
  type: "file-start";
  name: string;
  size: number;
  mime: string;
};

export type FileEndMessage = {
  type: "file-end";
  name: string;
};

export function splitIntoChunks(buffer: ArrayBuffer): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_SIZE) {
    chunks.push(buffer.slice(offset, offset + CHUNK_SIZE));
  }
  return chunks;
}

export function createFileHeader(file: File): string {
  return JSON.stringify({
    type: "file-start",
    name: file.name,
    size: file.size,
    mime: file.type,
  } satisfies FileHeader);
}

export function assembleFile(chunks: ArrayBuffer[], mime: string): Blob {
  return new Blob(chunks, { type: mime });
}

export async function* streamFileChunks(file: File): AsyncGenerator<ArrayBuffer> {
  let offset = 0;
  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    yield await slice.arrayBuffer();
    offset += CHUNK_SIZE;
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
