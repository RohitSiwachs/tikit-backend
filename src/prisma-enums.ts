export enum Role {
  TIKIT_ADMIN = 'TIKIT_ADMIN',
  KARORDFORANDE = 'KARORDFORANDE',
  EVENTANSVARIG = 'EVENTANSVARIG',
  SCANNER = 'SCANNER',
  STUDENT = 'STUDENT',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  DEACTIVATED = 'DEACTIVATED',
}

export enum EventType {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}

export enum TicketStatus {
  ISSUED = 'ISSUED',
  CHECKED_IN = 'CHECKED_IN',
  VOID = 'VOID',
}
