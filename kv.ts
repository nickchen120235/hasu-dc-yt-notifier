import { getChannel, getVideo } from "./youtube.ts";
import { DISCORD_WEBHOOK } from "./core.ts";
import { Notification } from "./types.ts";

enum QueueEventType {
  RECEIVED_VIDEO = "RECEIVED_VIDEO",
  SCHEDULED_VIDEO = "SCHEDULED_VIDEO",
};

export const kv = await Deno.openKv(Deno.env.get("KV_PATH"));

type ReceivedVideoEvent = {
  type: QueueEventType.RECEIVED_VIDEO,
  video: Notification,
}
type ScheduledVideoEvent = {
  type: QueueEventType.SCHEDULED_VIDEO,
  videoUrl: string,
}
type Event = ReceivedVideoEvent | ScheduledVideoEvent;

async function sendToDiscord(content: string) {
  const channelInfo = await getChannel();
  const username = channelInfo?.title ?? "蓮ノ空女学院スクールアイドルクラブ公式チャンネル";
  const avatar_url = channelInfo?.thumbnails.high?.url ?? "https://www.lovelive-anime.jp/hasunosora/shared/img/common/ft_app2_icon.png"; // puchihasu
  await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, username, avatar_url }),
  });
}

async function queueVideoForLater(videoUrl: string, scheduledStartTime: Date) {
  const delay = scheduledStartTime.valueOf() - new Date().valueOf();
  await kv.enqueue({ type: QueueEventType.SCHEDULED_VIDEO, videoUrl }, { delay });
}

async function processReceivedVideo(video: Notification) {
  const videoData = await getVideo(video.videoId);
  if (videoData === null) {
    console.warn(`Failed to get video data for ${video.videoUrl}`);
    await kv.delete(["video", video.videoId]);
    return;
  }
  const trueTimestamp = Math.floor(new Date(videoData.snippet.publishedAt).valueOf() / 1000);
  const lastReceived = (await kv.get<number>(["property", "lastReceivedTimestamp"])).value;
  if (lastReceived && lastReceived > trueTimestamp) {
    console.warn(`Skipping old video ${video.videoUrl}`);
    return;
  }
  // queue it for later if it is a premiere/live video
  if (videoData.snippet.liveBroadcastContent === "upcoming") {
    const scheduledStartTime = new Date(videoData.liveStreamingDetails!.scheduledStartTime!);
    await queueVideoForLater(video.videoUrl, scheduledStartTime);
    await sendToDiscord(`${video.videoUrl} 即將於 <t:${scheduledStartTime.valueOf() / 1000}> 直播/公開`);
    return;
  }
  else {
    await sendToDiscord(video.videoUrl);
  }
  await kv.set(["property", "lastReceivedTimestamp"], trueTimestamp);
}

export async function processNotification(video: Notification) {
  await kv.enqueue({ type: QueueEventType.RECEIVED_VIDEO, video }, { delay: 5000 });
}

kv.listenQueue(async (event: Event) => {
  try {
    switch (event.type) {
      case QueueEventType.RECEIVED_VIDEO:
        await processReceivedVideo(event.video);
        break;
      case QueueEventType.SCHEDULED_VIDEO:
        await sendToDiscord(event.videoUrl);
        break;
    }
  }
  catch (e) {
    if (e instanceof Error) console.error(`Error processing event: ${e.message}`);
    else console.error(`Error processing event: ${JSON.stringify(e)}`);
  }
});
