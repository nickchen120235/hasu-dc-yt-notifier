import { Notification, isRawNotification } from "/types.ts";

class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

export function parseNotification(notification: unknown): Notification {
  if (!isRawNotification(notification))
      throw new ParseError(`Invalid notification: ${JSON.stringify(notification)}`)
  const { entry } = notification.feed
  return {
    channelId: entry['yt:channelId'],
    channelName: entry.author.name,
    videoId: entry['yt:videoId'],
    videoUrl: `https://www.youtube.com/watch?v=${entry['yt:videoId']}`,
    published: new Date(entry.published).valueOf()
  }
}
