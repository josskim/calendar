import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const recentOrders = await prisma.intra_orders.findMany({
        where: {
            site: "domegod",
            created_at: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
        },
        orderBy: { created_at: "desc" },
        take: 10
    });
    console.log("Recent Domae-ui-sin orders:", recentOrders.length);
    recentOrders.forEach(o => {
        console.log(`- ID: ${o.id}, Buyer: ${o.buyer}, Num1: ${o.order_num1}, Num2: ${o.order_num2}, Created: ${o.created_at}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
