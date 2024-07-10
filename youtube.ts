import { ky, YOUTUBE_API_KEY, YT_CHANNEL_ID } from "./core.ts";
import {
  VideoListResponse,
  Video as _Video,
  VideoSnippet as _VideoSnippet,
  ChannelListResponse,
  ChannelSnippet,
} from "https://googleapis.deno.dev/v1/youtube:v3.ts";

const api = ky.create({
  prefixUrl: "https://youtube.googleapis.com/youtube/v3",
  searchParams: {
    key: YOUTUBE_API_KEY,
    maxResults: 1,
  },
});

// @ts-expect-error this is the correct type
interface VideoSnippet extends _VideoSnippet {
  publishedAt: string;
}
export interface Video extends _Video {
  snippet: Required<VideoSnippet>;
}
export async function getVideo(videoId: string): Promise<Video | null> {
  const res = await api.get("videos", {
    searchParams: {
      id: videoId,
      part: "snippet,liveStreamingDetails",
    },
  });
  if (!res.ok) {
    throw new Error(JSON.stringify(await res.json()));
  }
  const data = await res.json() as Required<VideoListResponse>;
  if (data.items[0]) {
    return data.items[0] as Video;
  }
  else return null;
}

export async function getChannel(): Promise<Required<ChannelSnippet> | null> {
  const res = await api.get("channels", {
    searchParams: {
      id: YT_CHANNEL_ID,
      part: "snippet",
    },
  });
  if (!res.ok) {
    throw new Error(JSON.stringify(await res.json()));
  }
  const data = await res.json() as Required<ChannelListResponse>;
  if (data.items && data.items[0].snippet) {
    return data.items[0].snippet as Required<ChannelSnippet>;
  }
  else return null;
}
