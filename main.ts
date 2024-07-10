import { xml, CALLBACK_ENDPOINT, YT_CHANNEL_ID } from "/core.ts";
import { parseNotification } from "./parse.ts";
import { kv, processNotification } from "./kv.ts";

Deno.serve(async (req) => {
  console.log(`${req.method} ${req.url}`)
  switch (req.method) {
    case "GET": {
      const url = new URL(req.url);
      const topic = url.searchParams.get('hub.topic');
      const challenge = url.searchParams.get('hub.challenge');
      const lease = url.searchParams.get('hub.lease_seconds');
      if (topic && challenge && lease) {
        console.log('Received callback challenge');
        await kv.set(["property", "expires"], parseInt(lease) + Math.floor(Date.now() / 1000));
        return new Response(challenge, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain'
          },
        });
      }
      else return new Response(null, { status: 400 });
    }
    case "POST": {
      try {
        const body = await req.text();
        const notification = parseNotification(xml.parse(body));
        if ((await kv.get<number>(["video", notification.videoId])).value !== null) {
          console.log(`We have received ${notification.videoUrl} recently`);
          return new Response(null, { status: 204 });
        }
        // cache video id for 7 days to prevent duplicate notifications
        await kv.set(["video", notification.videoId], new Date().valueOf(), { expireIn: 1000 * 86400 * 7 });
        await processNotification(notification);
        return new Response(null, { status: 204 });
      }
      catch (error) {
        console.error("Error processing notification:");
        if (error instanceof Error) console.error(`${error.name}: ${error.message}`);
        else console.error(JSON.stringify(error));
        return new Response(null, { status: 500 });
      }
    }
    default:
      return new Response(null, { status: 405 });
  }
});

Deno.cron("update subscription", "0 0,12 * * *", async () => {
  const expires = (await kv.get<number>(["property", "expires"])).value;
  if (!expires) return;
  console.log("Updating subscription");
  const form = new FormData();
  form.set('hub.callback', CALLBACK_ENDPOINT);
  form.set('hub.topic', `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`);
  form.set('hub.verify', 'async');
  form.set('hub.mode', 'subscribe');
  form.set('hub.verify_token', '');
  form.set('hub.secret', '');
  form.set('hub.lease_numbers', '');
  const res = await fetch('https://pubsubhubbub.appspot.com/subscribe', {
    method: 'POST',
    body: form
  });
  if (!res.ok)
    throw new Error(`${res.status} ${res.statusText}`);
});
