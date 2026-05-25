export enum UserRole {
  STUDENT = 'student',
  KAR_ADMIN = 'kar_admin',
  TIKIT_ADMIN = 'tikit_admin',
}

export enum EventType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
}

export enum TicketStatus {
  VALID = 'valid',
  USED = 'used',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum CardType {
  FESTKORT = 'festkort',
  VIP = 'vip',
}

export enum CardStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
}

export enum PostType {
  TEXT = 'text',
  POLL = 'poll',
  EVENT_PROMO = 'event_promo',
}

export enum FollowType {
  USER = 'user',
  SCHOOL = 'school',
}

export enum NotificationType {
  TICKET_AVAILABLE = 'ticket_available',
  EVENT_REMINDER = 'event_reminder',
  NEW_FOLLOWER = 'new_follower',
  COMMENT_REPLY = 'comment_reply',
  POLL_ENDED = 'poll_ended',
  CHECKIN_CONFIRMED = 'checkin_confirmed',
}
