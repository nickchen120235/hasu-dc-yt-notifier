// we extract what we want only
interface _Entry {
  'yt:videoId': string
  'yt:channelId': string
  author: {
    name: string
  }
  published: string
}

interface _Notification {
  feed: {
    entry: _Entry
  }
}

function isEntry(data: unknown): data is _Entry {
  return data !== null && typeof data === 'object' &&
  'yt:videoId' in data && typeof data['yt:videoId'] === 'string' &&
  'yt:channelId' in data && typeof data['yt:channelId'] ==='string' &&
  'author' in data && typeof data.author === 'object' && data.author !== null &&
  'name' in data.author && typeof data.author.name ==='string' &&
  'published' in data && typeof data.published === 'string'
}

export function isRawNotification(data: unknown): data is _Notification {
  return data !== null && typeof data === 'object' &&
    'feed' in data && typeof data.feed === 'object' && data.feed !== null &&
    'entry' in data.feed && isEntry(data.feed.entry)
}

export interface Notification {
  channelId: string
  channelName: string
  videoId: string
  videoUrl: string
  published: number
}

class _DiscordYouTubeData {
  constructor(
    readonly ytChannelId?: string,
    readonly dcChannelId?: string,
    readonly channelName?: string,
    readonly channelImage?: string,
    readonly webhookId?: string,
    readonly webhookToken?: string,
  ) { }
}

export type DiscordYouTubeData = Required<_DiscordYouTubeData>;

class _YouTubeData {
  constructor(
    readonly channelHandle?: string,
    readonly channelId?: string,
    readonly discordChannelId?: string,
    readonly channelName?: string,
    readonly channelImage?: string,
    readonly latestVideo?: string | null,
    readonly publishTime?: number | null,
    readonly subExpireTime?: number,
  ) { }
}

export type YouTubeData = Required<_YouTubeData>;
