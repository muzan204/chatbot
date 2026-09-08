import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { addMetadata } from "../src/services/stickers.js";
import { askAI } from "../src/services/ai.js";
import { request } from "../src/services/http.js";

test("WebP com metadados permanece decodificável", async () => {
  const input = await sharp({
    create: { width: 512, height: 512, channels: 4, background: "#4834d4" },
  })
    .webp()
    .toBuffer();
  const output = addMetadata(input);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(output.readUInt32LE(4), output.length - 8);
  assert.ok(metadata.exif.toString().includes("OS NOTURNOS"));
  await sharp(output).png().toBuffer();
});

test("IA sem configuração informa que está desativada", async () => {
  const prior = process.env.AI_PROVIDER;
  delete process.env.AI_PROVIDER;
  try {
    await assert.rejects(askAI("Olá"), /desativada/);
  } finally {
    if (prior !== undefined) process.env.AI_PROVIDER = prior;
  }
});

test("HTTP mascara erros de provedor e limita resposta", async () => {
  const prior = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new Error("secret-api-key");
    };
    await assert.rejects(
      request("https://example.com"),
      (error) =>
        !error.message.includes("secret-api-key") &&
        error.message.includes("serviço externo"),
    );
    globalThis.fetch = async () => new Response("x".repeat(1000001));
    await assert.rejects(request("https://example.com"), /serviço externo/);
  } finally {
    globalThis.fetch = prior;
  }
});
