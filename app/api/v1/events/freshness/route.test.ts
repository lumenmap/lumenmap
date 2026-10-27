import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { freshnessBroadcaster } from "@/lib/hubble/freshness";

describe("GET /api/v1/events/freshness", () => {
  test("returns 200 and standard text/event-stream headers", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/events/freshness");
    const response = await GET(req);

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("content-type"),
      "text/event-stream; charset=utf-8",
    );
    assert.match(response.headers.get("cache-control") ?? "", /no-cache/);
    assert.equal(response.headers.get("connection"), "keep-alive");
    assert.equal(response.headers.get("x-accel-buffering"), "no");

    if (response.body) {
      await response.body.cancel();
    }
  });

  test("emits initial freshness payload immediately on connect", async () => {
    freshnessBroadcaster.reset(1700000000000);

    const abortController = new AbortController();
    const req = new NextRequest("http://localhost:3000/api/v1/events/freshness", {
      signal: abortController.signal,
    });

    const response = await GET(req);
    assert.ok(response.body);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const { value, done } = await reader.read();
    assert.equal(done, false);

    const text = decoder.decode(value);
    assert.match(text, /^event: freshness\n/);
    assert.match(text, /"epoch":1700000000000/);
    assert.match(text, /"reason":"initial"/);

    abortController.abort();
    await reader.cancel();
  });

  test("streams freshness events when cache rotates", async () => {
    const abortController = new AbortController();
    const req = new NextRequest("http://localhost:3000/api/v1/events/freshness", {
      signal: abortController.signal,
    });

    const response = await GET(req);
    assert.ok(response.body);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // 1. Initial connect frame
    const { value: initialChunk } = await reader.read();
    const initialText = decoder.decode(initialChunk);
    assert.match(initialText, /^event: freshness\n/);

    // 2. Trigger cache rotation notification
    const testKeys = ["activity:v14:mainnet:1d:2026-10-22T00:00:00.000Z"];
    freshnessBroadcaster.notifyCacheRotation(testKeys, "cache_set");

    // 3. Read broadcasted event frame
    const { value: rotationChunk } = await reader.read();
    const rotationText = decoder.decode(rotationChunk);

    assert.match(rotationText, /^event: freshness\n/);
    assert.match(rotationText, /"reason":"cache_set"/);
    assert.match(
      rotationText,
      /"keys":\["activity:v14:mainnet:1d:2026-10-22T00:00:00.000Z"\]/,
    );

    abortController.abort();
    await reader.cancel();
  });

  test("handles client disconnection via abort signal gracefully", async () => {
    const abortController = new AbortController();
    const req = new NextRequest("http://localhost:3000/api/v1/events/freshness", {
      signal: abortController.signal,
    });

    const response = await GET(req);
    assert.ok(response.body);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Read initial frame
    const { value } = await reader.read();
    assert.ok(value);
    assert.match(decoder.decode(value), /^event: freshness\n/);

    // Abort request
    abortController.abort();

    // Next read should complete/cancel cleanly without hanging or error
    const nextResult = await reader.read();
    assert.equal(nextResult.done, true);
  });
});
