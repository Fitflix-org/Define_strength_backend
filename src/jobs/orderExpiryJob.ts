import prisma from '../utils/prisma';

export function startOrderExpiryJob(options?: { ttlMinutes?: number; intervalMs?: number }) {
    const ttlMinutes = options?.ttlMinutes ?? 30;
    const intervalMs = options?.intervalMs ?? 5 * 60 * 1000; // every 5 minutes

    const run = async () => {
        const threshold = new Date(Date.now() - ttlMinutes * 60 * 1000);
        try {
            // Test database connection first
            await prisma.$queryRaw`SELECT 1`;
            
            const expired = await prisma.order.updateMany({
                where: {
                    status: 'PAYMENT_INITIATED' as any,
                    updatedAt: { lt: threshold },
                },
                data: { status: 'FAILED' as any },
            });
            if (expired.count > 0) {
                console.log(`[OrderExpiryJob] Marked ${expired.count} order(s) as FAILED (expired)`);
            }
        } catch (e) {
            console.error('[OrderExpiryJob] Error expiring orders:', e);
            // Don't log connection errors repeatedly
            if (e && typeof e === 'object' && 'code' in e && e.code !== 'P1001') {
                console.error('[OrderExpiryJob] Database connection error, will retry later');
            }
        }
    };

    // Wait longer for database to be ready, then start the job
    setTimeout(() => {
        console.log('[OrderExpiryJob] Starting order expiry job...');
        run(); // Run once immediately
        setInterval(run, intervalMs); // Then run every interval
    }, 30 * 1000); // Wait 30 seconds instead of 15
}


