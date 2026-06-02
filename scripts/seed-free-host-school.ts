import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting freeForHostSchool Demo Seed...\n');

  // ── 1. Clean existing database records (FK-safe order) ─────────────────
  console.log('🧹 Clearing existing records...');
  await prisma.$executeRawUnsafe('DELETE FROM "_UserFollows"');
  await prisma.$executeRawUnsafe('DELETE FROM "_UserFriends"');
  await prisma.$executeRawUnsafe('DELETE FROM "_EventConnectedSchools"');
  await prisma.followRequest.deleteMany({});
  await prisma.postLike.deleteMany({});
  await prisma.postComment.deleteMany({});
  await prisma.eventLike.deleteMany({});
  await prisma.eventComment.deleteMany({});
  await prisma.eventConnectionRequest.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.voucher.deleteMany({});
  await prisma.ticketType.deleteMany({});
  await prisma.cardCode.deleteMany({});
  await prisma.card.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.class.deleteMany({});
  await prisma.segment.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.school.deleteMany({});
  console.log('🧹 Database clean complete.\n');

  // ── 2. Hash passwords ─────────────────────────────────────────────────
  const pwAdmin = await bcrypt.hash('admin@123', 10);
  const pwSchoolAdmin = await bcrypt.hash('dummy@123', 10);
  const pwStudent = await bcrypt.hash('demo@123', 10);

  // ── 3. Create Schools ─────────────────────────────────────────────────
  console.log('🏫 Creating Schools...');
  const hostSchool = await prisma.school.create({
    data: {
      name: 'TiKit Academy',
      slug: 'tikit-academy',
      schoolCode: 'TK123',
      city: 'Stockholm',
      isVerified: true,
      isActive: true,
      description: 'The flagship TiKit school for testing.',
    },
  });

  const externalSchool = await prisma.school.create({
    data: {
      name: 'North High School',
      slug: 'north-high',
      schoolCode: 'NHS001',
      city: 'Stockholm',
      isVerified: true,
      isActive: true,
      description: 'An external school for cross-school testing.',
    },
  });
  console.log(`   ✅ ${hostSchool.name} (host school)`);
  console.log(`   ✅ ${externalSchool.name} (external school)\n`);

  // ── 4. Create Users ───────────────────────────────────────────────────
  console.log('👤 Creating Users...');

  // A. Tikit Super Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@gmail.com',
      username: 'tikit_admin',
      displayName: 'Super Admin',
      password: pwAdmin,
      role: 'TIKIT_ADMIN',
      accountStatus: 'ACTIVE',
      schoolId: hostSchool.id,
      isVerified: true,
      approvalStatus: 'approved',
    },
  });
  console.log(`   ✅ Admin:        admin@gmail.com / admin@123`);

  // B. School Admin (linked to TiKit Academy — the host school)
  const schoolAdmin = await prisma.user.create({
    data: {
      email: 'dummyschool@gmail.com',
      username: 'dummy_school_admin',
      displayName: 'Dummy School Admin',
      password: pwSchoolAdmin,
      role: 'KARORDFORANDE',
      accountStatus: 'ACTIVE',
      schoolId: hostSchool.id,
      isVerified: true,
      approvalStatus: 'approved',
    },
  });
  console.log(`   ✅ School Admin: dummyschool@gmail.com / dummy@123`);

  // C. Demo Student (linked to TiKit Academy — host-school student)
  const student = await prisma.user.create({
    data: {
      email: 'demostudent@gmail.com',
      username: 'demo_student',
      displayName: 'Demo Student',
      password: pwStudent,
      role: 'STUDENT',
      accountStatus: 'ACTIVE',
      schoolId: hostSchool.id,
      isVerified: true,
      approvalStatus: 'approved',
      cardStatus: 'active',
    },
  });
  console.log(`   ✅ Student:      demostudent@gmail.com / demo@123`);

  // D. External Student (linked to North High — for testing external claim rejection)
  const externalStudent = await prisma.user.create({
    data: {
      email: 'external@gmail.com',
      username: 'external_student',
      displayName: 'External Student',
      password: pwStudent,
      role: 'STUDENT',
      accountStatus: 'ACTIVE',
      schoolId: externalSchool.id,
      isVerified: true,
      approvalStatus: 'approved',
      cardStatus: 'active',
    },
  });
  console.log(`   ✅ External:     external@gmail.com / demo@123\n`);

  // ── 5. Create Events with freeForHostSchool Ticket Types ──────────────
  console.log('🎫 Creating Events with freeForHostSchool ticket types...\n');

  // Event 1: Internal event at TiKit Academy — showcases freeForHostSchool
  const internalEvent = await prisma.event.create({
    data: {
      title: 'TiKit Academy Summer Fest',
      description: 'The biggest summer event of the year! Live music, food trucks, and student activities.',
      eventType: 'INTERNAL',
      schoolId: hostSchool.id,
      venueName: 'Grand Assembly Hall',
      venueAddress: 'School Street 1, Stockholm',
      startsAt: new Date(Date.now() + 3 * 86400000),  // 3 days from now
      endsAt: new Date(Date.now() + 3 * 86400000 + 5 * 3600000),
      isPublished: true,
      status: 'published',
      ticketTypes: {
        create: [
          {
            name: 'Standard Admission',
            description: 'General entry to Summer Fest',
            price: 149,
            quantityTotal: 200,
            quantityRemaining: 200,
            priceDisplay: '149 SEK',
            freeForHostSchool: true,     // ✅ FREE for host-school students
          },
          {
            name: 'Early Bird',
            description: 'Discounted early access ticket',
            price: 99,
            quantityTotal: 50,
            quantityRemaining: 50,
            priceDisplay: '99 SEK',
            freeForHostSchool: true,     // ✅ FREE for host-school students
          },
          {
            name: 'VIP Backstage',
            description: 'Backstage access, meet the artists, premium seating',
            price: 499,
            quantityTotal: 20,
            quantityRemaining: 20,
            priceDisplay: '499 SEK',
            freeForHostSchool: false,    // ❌ NOT free — everyone pays
          },
          {
            name: 'Premium Dinner',
            description: 'Exclusive dinner with the school board and guest speakers',
            price: 899,
            quantityTotal: 10,
            quantityRemaining: 10,
            priceDisplay: '899 SEK',
            freeForHostSchool: false,    // ❌ NOT free — everyone pays
          },
        ],
      },
    },
    include: { ticketTypes: true },
  });

  console.log(`   🎉 ${internalEvent.title} (INTERNAL)`);
  for (const tt of internalEvent.ticketTypes) {
    const icon = tt.freeForHostSchool ? '🟢 FREE for host' : '🔴 PAID for all';
    console.log(`      ${icon}  ${tt.name} — ${tt.price} SEK`);
  }

  // Event 2: External event — uses external buy URL
  const externalEvent = await prisma.event.create({
    data: {
      title: 'Stockholm Music Awards',
      description: 'Annual city-wide music awards ceremony. Tickets via external provider.',
      eventType: 'EXTERNAL',
      schoolId: hostSchool.id,
      venueName: 'Stockholm Concert Hall',
      venueAddress: 'Hötorget 8, Stockholm',
      startsAt: new Date(Date.now() + 7 * 86400000),
      endsAt: new Date(Date.now() + 7 * 86400000 + 4 * 3600000),
      isPublished: true,
      status: 'published',
      externalBuyUrl: 'https://tickets.example.com/stockholm-music-awards',
      externalTicketStatus: 'IN_STOCK',
      ticketTypes: {
        create: [
          { name: 'General Admission', price: 350, quantityTotal: 500, quantityRemaining: 500, priceDisplay: '350 SEK' },
          { name: 'VIP', price: 1200, quantityTotal: 50, quantityRemaining: 50, priceDisplay: '1200 SEK' },
        ],
      },
    },
    include: { ticketTypes: true },
  });

  console.log(`\n   🎉 ${externalEvent.title} (EXTERNAL)`);
  for (const tt of externalEvent.ticketTypes) {
    console.log(`      🔵 External  ${tt.name} — ${tt.price} SEK`);
  }

  // Event 3: Internal event at External school — for multi-school testing
  const northEvent = await prisma.event.create({
    data: {
      title: 'North High Welcome Party',
      description: 'Welcome back party for North High students.',
      eventType: 'INTERNAL',
      schoolId: externalSchool.id,
      venueName: 'North Auditorium',
      venueAddress: 'North Street 5, Stockholm',
      startsAt: new Date(Date.now() + 5 * 86400000),
      endsAt: new Date(Date.now() + 5 * 86400000 + 3 * 3600000),
      isPublished: true,
      status: 'published',
      ticketTypes: {
        create: [
          {
            name: 'Free Entry',
            description: 'Free entry for North High students',
            price: 0,
            quantityTotal: 100,
            quantityRemaining: 100,
            priceDisplay: 'Free',
            freeForHostSchool: true,
          },
        ],
      },
    },
    include: { ticketTypes: true },
  });

  console.log(`\n   🎉 ${northEvent.title} (INTERNAL — North High)`);
  for (const tt of northEvent.ticketTypes) {
    const icon = tt.freeForHostSchool ? '🟢 FREE for host' : '🔴 PAID for all';
    console.log(`      ${icon}  ${tt.name} — ${tt.price} SEK`);
  }

  // ── 6. Create Student Cards ───────────────────────────────────────────
  console.log('\n💳 Creating Student Cards...');
  await prisma.card.create({
    data: {
      title: 'TiKit Academy Digital Card',
      schoolId: hostSchool.id,
      description: 'Official digital student union card for TiKit Academy.',
      benefits: ['Free entry to eligible events', '10% discount on paid tickets', 'Campus café discounts'],
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 3600000),
      status: 'active',
    },
  });

  await prisma.card.create({
    data: {
      title: 'North High Digital Card',
      schoolId: externalSchool.id,
      description: 'Official digital student union card for North High.',
      benefits: ['Free entry to North High events', 'Library access'],
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 3600000),
      status: 'active',
    },
  });
  console.log('   ✅ Student cards created for both schools.');

  // ── 7. Create a Voucher for VIP (to test voucher bypass) ──────────────
  console.log('\n🎟️  Creating test voucher for VIP Backstage...');
  const vipTicketType = internalEvent.ticketTypes.find(tt => tt.name === 'VIP Backstage')!;
  await prisma.voucher.create({
    data: {
      code: 'VCH-VIP-DEMO-001',
      eventId: internalEvent.id,
      ticketTypeId: vipTicketType.id,
      createdById: admin.id,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    },
  });
  console.log('   ✅ Voucher VCH-VIP-DEMO-001 for VIP Backstage (admin override test)');

  // ── Done ──────────────────────────────────────────────────────────────
  console.log('\n');
  console.log('════════════════════════════════════════════════════════');
  console.log('  ✨ Seed Complete — freeForHostSchool Demo Data');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
  console.log('  🔑 CREDENTIALS');
  console.log('  ────────────────────────────────────────────────────');
  console.log('  Admin:         admin@gmail.com        / admin@123');
  console.log('  School Admin:  dummyschool@gmail.com  / dummy@123');
  console.log('  Student:       demostudent@gmail.com  / demo@123');
  console.log('  External:      external@gmail.com     / demo@123');
  console.log('');
  console.log('  🏫 SCHOOLS');
  console.log('  ────────────────────────────────────────────────────');
  console.log(`  Host:     TiKit Academy   (${hostSchool.id})`);
  console.log(`  External: North High      (${externalSchool.id})`);
  console.log('');
  console.log('  🎫 freeForHostSchool TICKET TYPES');
  console.log('  ────────────────────────────────────────────────────');
  console.log('  Standard Admission  → 🟢 FREE for TiKit Academy students');
  console.log('  Early Bird          → 🟢 FREE for TiKit Academy students');
  console.log('  VIP Backstage       → 🔴 PAID for everyone');
  console.log('  Premium Dinner      → 🔴 PAID for everyone');
  console.log('');
  console.log('  🎟️  VOUCHER');
  console.log('  ────────────────────────────────────────────────────');
  console.log('  Code: VCH-VIP-DEMO-001 → VIP Backstage (admin bypass)');
  console.log('════════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
