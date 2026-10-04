import { PrismaClient  } from "../../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
declare global {
    // eslint-disable-next-line no-var
    var prismadb: PrismaClient;
}


const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});


if (process.env.NODE_ENV === "production") global.prismadb = prisma;


export default prisma; 
