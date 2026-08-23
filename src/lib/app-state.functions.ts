/* eslint-disable @typescript-eslint/no-explicit-any */
type JsonObject = Record<string, any>;
import { createServerFn } from "@tanstack/react-start";

export const getAppState = createServerFn({ method: "GET" }).handler(async () => {
  const { readAppState } = await import("./app-state.server");
  return await readAppState();
});

export const saveAppState = createServerFn({ method: "POST" })
  .validator((input: JsonObject) => input)
  .handler(async ({ data }) => {
    const { writeAppState } = await import("./app-state.server");
    // The client passes the full app state as the payload; ignore sync metadata.
    const { base: _base, ...rest } = (data ?? {}) as JsonObject;
    const inner = rest["data"];
    const payload = (inner && typeof inner === "object" ? inner : rest) as JsonObject;
    return await writeAppState(payload);
  });
