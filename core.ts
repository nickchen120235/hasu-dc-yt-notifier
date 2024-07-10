export * as xml from "https://deno.land/x/xml@4.0.0/mod.ts";
import ky from "https://esm.sh/ky@^1.2.4";
export { ky };
import * as dotenv from "https://deno.land/std@0.224.0/dotenv/mod.ts";

await dotenv.load({ export: true });
const _CALLBACK_ENDPOINT = Deno.env.get("CALLBACK_ENDPOINT");
const _DISCORD_WEBHOOK = Deno.env.get("DISCORD_WEBHOOK");
const _YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
if (!_CALLBACK_ENDPOINT || !_DISCORD_WEBHOOK || !_YOUTUBE_API_KEY) {
  console.error("Missing environment variables");
}

// constants
export const CALLBACK_ENDPOINT = _CALLBACK_ENDPOINT!;
export const DISCORD_WEBHOOK = _DISCORD_WEBHOOK!;
export const YOUTUBE_API_KEY = _YOUTUBE_API_KEY!;
export const YT_CHANNEL_ID = "UCxUgvwrVfqVpyak4cuKcevQ"; // lovelive_hasu
