const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanSchools() {
  console.log('Starting school cleanup...');
  try {
    await prisma.$transaction(async (tx) => {
      console.log('-> Deleting classes...');
      await tx.class.deleteMany({});
      
      console.log('-> Deleting cards and card codes...');
      await tx.cardCode.deleteMany({});
      await tx.card.deleteMany({});
      
      console.log('-> Deleting events and tickets...');
      await tx.ticket.deleteMany({});
      await tx.voucher.deleteMany({});
      await tx.ticketType.deleteMany({});
      await tx.eventConnectionRequest.deleteMany({});
      await tx.eventConnectionState.deleteMany({});
      await tx.eventLike.deleteMany({});
      await tx.eventComment.deleteMany({});
      await tx.notificationTriggerOverride.deleteMany({});
      await tx.event.deleteMany({});
      
      console.log('-> Deleting posts and polls...');
      await tx.pollVote.deleteMany({});
      await tx.pollOption.deleteMany({});
      await tx.postComment.deleteMany({});
      await tx.postLike.deleteMany({});
      await tx.post.deleteMany({});

      console.log('-> Deleting communication allocations...');
      await tx.communicationAllocation.deleteMany({});
      
      console.log('-> Deleting school invite codes...');
      await tx.schoolInviteCode.deleteMany({});
      
      console.log('-> Finally, deleting the schools...');
      const deletedSchools = await tx.school.deleteMany({});
      
      console.log(`\n✅ Successfully deleted ${deletedSchools.count} schools and all their associated data.`);
    }, { maxWait: 15000, timeout: 60000 });
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanSchools();
