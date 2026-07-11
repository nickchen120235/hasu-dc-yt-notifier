import { getChannel, getVideo } from "./youtube.ts";
import { DISCORD_WEBHOOK } from "./core.ts";
import { Notification } from "./types.ts";

export const kv = await Deno.openKv(Deno.env.get("KV_PATH"));

const SCHEDULED_VIDEO_PREFIX = ["scheduledVideo"] as const;
const SCHEDULED_VIDEO_POLL_INTERVAL_MS = 5 * 60 * 1000;
const SCHEDULED_VIDEO_MAX_ATTEMPTS = 3;

type ScheduledVideo = {
  videoUrl: string;
  channelId: string;
  scheduledStartTime: number;
  attempts: number;
  processingUntil?: number;
};

async function sendToDiscord(content: string, channelId: string) {
  console.log(`Sending to Discord: ${content}`);
  const channelInfo = await getChannel(channelId);
  const username = channelInfo?.title ?? "Unknown Channel";
  const avatar_url = channelInfo?.thumbnails.high?.url ??
    "https://www.lovelive-anime.jp/hasunosora/shared/img/common/ft_app2_icon.png"; // puchihasu
  const response = await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, username, avatar_url }),
  });
  if (!response.ok) {
    throw new Error(
      `Discord webhook returned ${response.status} ${response.statusText}`,
    );
  }
}

async function scheduleVideoForLater(
  video: Notification,
  channelId: string,
  scheduledStartTime: Date,
) {
  const scheduledStartTimeMs = scheduledStartTime.valueOf();
  const record: ScheduledVideo = {
    videoUrl: video.videoUrl,
    channelId,
    scheduledStartTime: scheduledStartTimeMs,
    attempts: 0,
  };
  await kv.set(
    [...SCHEDULED_VIDEO_PREFIX, scheduledStartTimeMs, video.videoId],
    record,
  );
}

async function processReceivedVideo(video: Notification) {
  const videoData = await getVideo(video.videoId);
  if (videoData === null) {
    console.warn(`Failed to get video data for ${video.videoUrl}`);
    await kv.delete(["video", video.videoId]);
    return;
  }
  const trueTimestamp = Math.floor(
    new Date(videoData.snippet.publishedAt).valueOf() / 1000,
  );
  let isOldVideo = false;
  const lastReceived = (await kv.get<number>([
    "property",
    "lastReceivedTimestamp",
    videoData.snippet.channelId,
  ])).value;
  if (lastReceived && lastReceived > trueTimestamp) {
    console.warn(`Skipping old video ${video.videoUrl}`);
    isOldVideo = true;
  }
  // Schedule a second notification for a premiere/live video.
  if (videoData.snippet.liveBroadcastContent === "upcoming") {
    const scheduledStartTime = new Date(
      videoData.liveStreamingDetails!.scheduledStartTime!,
    );
    await scheduleVideoForLater(
      video,
      videoData.snippet.channelId,
      scheduledStartTime,
    );
    await sendToDiscord(
      `${video.videoUrl} 即將於 <t:${
        scheduledStartTime.valueOf() / 1000
      }> 直播/公開`,
      videoData.snippet.channelId,
    );
    return;
  }
  if (!isOldVideo) {
    await sendToDiscord(video.videoUrl, videoData.snippet.channelId);
    await kv.set([
      "property",
      "lastReceivedTimestamp",
      videoData.snippet.channelId,
    ], trueTimestamp);
  }
}

export async function processNotification(video: Notification) {
  await processReceivedVideo(video);
}

export async function processDueScheduledVideos(now = Date.now()) {
  for await (
    const entry of kv.list<ScheduledVideo>({
      prefix: SCHEDULED_VIDEO_PREFIX,
    })
  ) {
    const scheduledStartTime = entry.key[1];
    if (typeof scheduledStartTime !== "number") {
      console.error(
        `Ignoring scheduled-video record with an invalid key: ${
          JSON.stringify(entry.key)
        }`,
      );
      continue;
    }
    if (scheduledStartTime > now) break;

    const record = entry.value;
    if (record.processingUntil && record.processingUntil > now) continue;

    const claimedRecord: ScheduledVideo = {
      ...record,
      processingUntil: now + SCHEDULED_VIDEO_POLL_INTERVAL_MS,
    };
    const claim = await kv.atomic()
      .check({ key: entry.key, versionstamp: entry.versionstamp })
      .set(entry.key, claimedRecord)
      .commit();
    if (!claim.ok) continue;

    try {
      await sendToDiscord(record.videoUrl, record.channelId);
      const deleted = await kv.atomic()
        .check({ key: entry.key, versionstamp: claim.versionstamp })
        .delete(entry.key)
        .commit();
      if (!deleted.ok) {
        console.warn(
          `Scheduled video was changed before it could be removed: ${record.videoUrl}`,
        );
      }
    } catch (error) {
      const attempts = record.attempts + 1;
      if (attempts >= SCHEDULED_VIDEO_MAX_ATTEMPTS) {
        const deleted = await kv.atomic()
          .check({ key: entry.key, versionstamp: claim.versionstamp })
          .delete(entry.key)
          .commit();
        if (deleted.ok) {
          console.error(
            `Giving up on scheduled video after ${attempts} attempts: ${record.videoUrl}`,
          );
        }
        continue;
      }

      const released = await kv.atomic()
        .check({ key: entry.key, versionstamp: claim.versionstamp })
        .set(entry.key, { ...record, attempts })
        .commit();
      if (!released.ok) {
        console.warn(
          `Scheduled video was changed before it could be retried: ${record.videoUrl}`,
        );
      }
      if (error instanceof Error) {
        console.error(`Error sending scheduled video: ${error.message}`);
      } else {console.error(
          `Error sending scheduled video: ${JSON.stringify(error)}`,
        );}
    }
  }
}

Deno.cron("send scheduled videos", "*/5 * * * *", async () => {
  try {
    await processDueScheduledVideos();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error processing scheduled videos: ${error.message}`);
    } else {console.error(
        `Error processing scheduled videos: ${JSON.stringify(error)}`,
      );}
  }
});
