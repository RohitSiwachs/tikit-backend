# TiKit Backend Generation Specification

This specification contains all the technical details (Schema, DTOs, Routes) required to generate a complete backend for the TiKit Admin Dashboard.

## 1. Database Schema (Prisma Format)

```prisma
// Roles: tikit_admin, karordforande, eventansvarig, scanner, student
enum Role {
  TIKIT_ADMIN
  KARORDFORANDE
  EVENTANSVARIG
  SCANNER
  STUDENT
}

enum AccountStatus {
  ACTIVE
  INVITED
  DEACTIVATED
}

enum EventType {
  INTERNAL
  EXTERNAL
}

enum TicketStatus {
  ISSUED
  CHECKED_IN
  VOID
}

model School {
  id            String   @id @default(uuid())
  name          String
  slug          String   @unique
  city          String
  description   String?
  logoUrl       String?
  coverUrl      String?
  websiteUrl    String?
  schoolCode    String   @unique
  isVerified    Boolean  @default(false)
  isActive      Boolean  @default(true)
  contactEmail  String?
  contactPhone  String?
  address       String?
  users         User[]
  events        Event[]
  cards         Card[]
  posts         Post[]
  createdAt     DateTime @default(now())
}

model User {
  id              String        @id @default(uuid())
  email           String        @unique
  displayName     String
  username        String        @unique
  phone           String?
  role            Role          @default(STUDENT)
  accountStatus   AccountStatus @default(ACTIVE)
  schoolId        String?
  school          School?       @relation(fields: [schoolId], references: [id])
  className       String?
  age             Int?
  avatarUrl       String?
  isVerified      Boolean       @default(false)
  approvalStatus  String        @default("pending") // approved, pending, rejected
  cardStatus      String        @default("inactive") // active, inactive, blocked
  marketingConsent Boolean      @default(false)
  tickets         Ticket[]
  posts           Post[]
  createdAt       DateTime      @default(now())
}

model Event {
  id                  String      @id @default(uuid())
  title               String
  description         String?
  coverUrl            String?
  eventType           EventType   @default(INTERNAL)
  schoolId            String
  school              School      @relation(fields: [schoolId], references: [id])
  venueName           String?
  venueAddress        String?
  startsAt            DateTime
  endsAt              DateTime
  externalBuyUrl      String?
  isPublished         Boolean     @default(false)
  isCancelled         Boolean     @default(false)
  ticketTypes         TicketType[]
  tickets             Ticket[]
  posts               Post[]
  createdAt           DateTime    @default(now())
}

model TicketType {
  id                String   @id @default(uuid())
  eventId           String
  event             Event    @relation(fields: [eventId], references: [id])
  name              String
  description       String?
  priceDisplay      String
  quantityTotal     Int
  quantityRemaining Int
  isSoldOut         Boolean  @default(false)
}

model Ticket {
  id           String       @id @default(uuid())
  userId       String
  user         User         @relation(fields: [userId], references: [id])
  eventId      String
  event        Event        @relation(fields: [eventId], references: [id])
  ticketTypeId String
  code         String       @unique
  qrToken      String       @unique
  status       TicketStatus @default(ISSUED)
  checkedInAt  DateTime?
  createdAt    DateTime     @default(now())
}

model Card {
  id                 String   @id @default(uuid())
  title              String
  schoolId           String
  school             School   @relation(fields: [schoolId], references: [id])
  coverUrl           String?
  description        String?
  validFrom          DateTime
  validUntil         DateTime
  status             String   @default("draft") // draft, active, blocked
  codeGenerationType String   @default("individual") // individual, batch
  createdAt          DateTime @default(now())
}

model Post {
  id          String   @id @default(uuid())
  body        String
  imageUrl    String?
  postType    String   @default("text") // text, image, poll, event_card
  schoolId    String
  school      School   @relation(fields: [schoolId], references: [id])
  authorId    String
  author      User     @relation(fields: [authorId], references: [id])
  eventId     String?
  event       Event?   @relation(fields: [eventId], references: [id])
  createdAt   DateTime @default(now())
}
```

## 2. API Routes & Endpoints

### Auth
- `POST /auth/login`: Returns JWT and User object.
- `POST /auth/register`: For student signup with `schoolCode`.

### Admin Dashboard
- `GET /admin/dashboard/stats`: Returns `{ totalSchools, totalStudents, upcomingEvents, activeCards, checkinRate }`.

### School Module
- `GET /schools`: Pagination, search by name/city.
- `GET /schools/:id`: Details with user counts.
- `POST /schools`: Create school (Admin only).
- `PATCH /schools/:id`: Update info.

### User Module
- `GET /users`: Filter by `role`, `schoolId`, `approvalStatus`.
- `PATCH /users/:id/role`: Update role (Admin only).
- `PATCH /users/:id/approval`: Approve/Reject user.

### Event Module
- `GET /events`: List all events.
- `POST /events`: Create event + nested `ticketTypes`.
- `PATCH /events/:id`: Update event (publish/cancel).
- `GET /events/:id/attendees`: List of users with tickets for this event.

### Ticketing & Cards
- `PATCH /tickets/:id/void`: Change status to `VOID`.
- `POST /cards`: Create card template.
- `POST /cards/:id/generate-codes`: Returns a list of unique codes based on `count`.

### Communication
- `POST /notifications/send`: Target users by `segmentFilters` (age, school, event attendance).

## 3. Business Logic Rules
1.  **School Code Validation**: Users can only register if they provide a valid `schoolCode` matching a school in the DB.
2.  **RBAC**:
    *   `TIKIT_ADMIN`: Can do everything.
    *   `KARORDFORANDE`: Can manage users and events for THEIR school only.
    *   `SCANNER`: Can only call `POST /tickets/check-in`.
3.  **Ticket Integrity**: `quantityRemaining` must decrement on every ticket issuance. No overselling.

## 4. Integration Details
- **Base URL**: `http://localhost:3001/api` (standard for development).
- **Format**: All requests/responses are JSON.
- **Headers**: `Authorization: Bearer <token>` required for all `/admin/*` routes.
