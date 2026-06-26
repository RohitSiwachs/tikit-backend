import * as crypto from 'crypto';

export const TTL = {
  EVENTS_LIST: 60,   // 60 s — events change occasionally
  EVENT_BASE: 60,    // 60 s — event detail (without user-specific fields)
  SCHOOLS_LIST: 300, // 5 min — school list changes rarely
  SCHOOL: 300,       // 5 min — single school record
  FEED_BASE: 30,     // 30 s — feed is high-freshness
  POSTS_LIST: 60,    // 60 s — post list
  POST_BASE: 60,     // 60 s — post detail (without user vote)
} as const;

function hash(obj: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(obj))
    .digest('hex')
    .slice(0, 16);
}

export const CK = {
  // Events
  eventsList: (params: unknown) => `events:list:${hash(params)}`,
  eventBase: (id: string) => `events:base:${id}`,

  // Schools
  schoolsList: (params: unknown) => `schools:list:${hash(params)}`,
  school: (id: string) => `schools:${id}`,

  // Posts / Feed
  feedBase: (page: number, limit: number, schoolId: string) => `feed:base:${schoolId}:${page}:${limit}`,
  postsList: (params: unknown) => `posts:list:${hash(params)}`,
  postBase: (id: string) => `posts:base:${id}`,
};
