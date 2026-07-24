const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('Starting cleanup process...');

  try {
    // 1. Find all users who are NOT super admins
    const usersToDelete = await prisma.user.findMany({
      where: {
        role: { not: 'TIKIT_ADMIN' }
      },
      select: { id: true }
    });

    const userIds = usersToDelete.map(u => u.id);
    console.log(`Found ${userIds.length} users/school_admins to delete.`);

    if (userIds.length === 0) {
      console.log('No non-admin users found. Exiting.');
      process.exit(0);
    }

    // 2. Perform deletions inside a transaction to prevent foreign key errors
    await prisma.$transaction(async (tx) => {
      console.log('-> Deleting user tickets...');
      await tx.ticket.deleteMany({ where: { userId: { in: userIds } } });

      console.log('-> Resetting user card codes...');
      // CardCodes belong to a Card, we just unassign the user instead of deleting the code entirely
      await tx.cardCode.updateMany({
        where: { userId: { in: userIds } },
        data: { userId: null, isUsed: false, assignedAt: null, usedAt: null }
      });

      console.log('-> Deleting follow requests...');
      await tx.followRequest.deleteMany({
        where: { OR: [{ senderId: { in: userIds } }, { receiverId: { in: userIds } }] }
      });

      console.log('-> Deleting social posts, likes, and comments...');
      await tx.postComment.deleteMany({ where: { authorId: { in: userIds } } });
      await tx.postLike.deleteMany({ where: { userId: { in: userIds } } });
      await tx.post.deleteMany({ where: { authorId: { in: userIds } } });

      console.log('-> Deleting event likes and comments...');
      await tx.eventComment.deleteMany({ where: { userId: { in: userIds } } });
      await tx.eventLike.deleteMany({ where: { userId: { in: userIds } } });

      console.log('-> Deleting poll votes...');
      await tx.pollVote.deleteMany({ where: { userId: { in: userIds } } });

      console.log('-> Deleting refresh tokens...');
      await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });

      console.log('-> Finally, deleting the users...');
      const deletedUsers = await tx.user.deleteMany({
        where: { id: { in: userIds } }
      });

      console.log(`\n✅ Successfully deleted ${deletedUsers.count} users/school_admins.`);
    }, { maxWait: 15000, timeout: 60000 });
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
