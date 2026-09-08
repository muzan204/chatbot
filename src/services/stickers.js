import sharp from "sharp";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config/index.js";
import { UserError } from "../utils/safety.js";
let busy = false;
export function addMetadata(webp) {
  const json = Buffer.from(
    JSON.stringify({
      "sticker-pack-id": randomUUID(),
      "sticker-pack-name": process.env.STICKER_PACK || "OS NOTURNOS",
      "sticker-pack-publisher": process.env.STICKER_AUTHOR || "OS NOTURNOS",
      emojis: ["🌙"],
    }),
  );
  const exif = Buffer.from([
    0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x41, 0x57, 7, 0, 0, 0, 0, 0, 0x16,
    0, 0, 0,
  ]);
  exif.writeUInt32LE(json.length, 14);
  const payload = Buffer.concat([exif, json]);
  const chunk = Buffer.alloc(8);
  chunk.write("EXIF");
  chunk.writeUInt32LE(payload.length, 4);
  let body = Buffer.from(webp.subarray(12));
  if (body.toString("ascii", 0, 4) === "VP8X") body[8] |= 8;
  else {
    const vp = Buffer.alloc(18);
    vp.write("VP8X");
    vp.writeUInt32LE(10, 4);
    vp[8] = 0x18;
    vp.writeUIntLE(511, 12, 3);
    vp.writeUIntLE(511, 15, 3);
    body = Buffer.concat([vp, body]);
  }
  const out = Buffer.concat([
    webp.subarray(0, 12),
    body,
    chunk,
    payload,
    Buffer.alloc(payload.length % 2),
  ]);
  out.writeUInt32LE(out.length - 8, 4);
  return out;
}
export async function sticker(content) {
  if (busy)
    throw new UserError(
      "Uma figurinha está sendo processada. Tente novamente em instantes.",
    );
  const media = content.imageMessage || content.videoMessage;
  if (!media)
    throw new UserError("Responda a uma imagem ou vídeo curto com !sticker.");
  const video = !!content.videoMessage;
  if (video && Number(media.seconds || 0) > config.maxVideo)
    throw new UserError(`Use vídeo de até ${config.maxVideo} segundos.`);
  if (Number(media.fileLength || 0) > config.maxMedia)
    throw new UserError("Arquivo muito grande. Limite de mídia excedido.");
  busy = true;
  let dir;
  try {
    const stream = await downloadContentFromMessage(
      media,
      video ? "video" : "image",
      { options: { signal: AbortSignal.timeout(30000) } },
    );
    const chunks = [];
    let length = 0;
    for await (const chunk of stream) {
      length += chunk.length;
      if (length > config.maxMedia) {
        stream.destroy();
        throw new UserError("Arquivo muito grande.");
      }
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks);
    let webp;
    if (!video)
      webp = await sharp(input, { limitInputPixels: 20000000 })
        .rotate()
        .resize(512, 512, { fit: "contain", background: "#00000000" })
        .webp({ quality: 75 })
        .toBuffer();
    else {
      dir = await mkdtemp(path.join(tmpdir(), "noturnos-"));
      const source = path.join(dir, "input"),
        target = path.join(dir, "sticker.webp");
      await writeFile(source, input);
      await new Promise((resolve, reject) => {
        const proc = spawn(
          process.env.FFMPEG_PATH || "ffmpeg",
          [
            "-y",
            "-i",
            source,
            "-t",
            String(config.maxVideo),
            "-vf",
            "fps=10,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
            "-c:v",
            "libwebp",
            "-loop",
            "0",
            "-an",
            "-q:v",
            "45",
            target,
          ],
          { windowsHide: true, stdio: "ignore", timeout: 30000 },
        );
        proc.on("error", () =>
          reject(
            new UserError("Instale o FFmpeg para criar figurinhas animadas."),
          ),
        );
        proc.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(new UserError("Não foi possível converter este vídeo.")),
        );
      });
      webp = await readFile(target);
    }
    const result = addMetadata(webp);
    if (result.length > 1000000)
      throw new UserError(
        "Figurinha muito grande. Use uma mídia mais simples ou curta.",
      );
    return result;
  } finally {
    busy = false;
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}
