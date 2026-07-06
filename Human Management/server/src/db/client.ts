import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "@app/shared/db/schema";
import * as relations from "@app/shared/db/relations";

const databaseFile = process.env.DATABASE_FILE ?? "./data/app.db";
mkdirSync(dirname(databaseFile), { recursive: true });

const client = createClient({ url: `file:${databaseFile}` });
await client.execute("PRAGMA foreign_keys = ON");

export const db = drizzle(client, { schema: { ...schema, ...relations } });
