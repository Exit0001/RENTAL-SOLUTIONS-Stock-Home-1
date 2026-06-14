import { type User, type InsertUser } from "@shared/schema";

// Interface กำหนดว่า storage ต้องมี method อะไรบ้าง
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

// MemStorage — เก็บข้อมูลใน RAM (ใช้ระหว่าง dev ก่อนต่อ database จริง)
export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      ...insertUser,
      id:        crypto.randomUUID(),
      role:      insertUser.role ?? "crew",
      authId:    insertUser.authId ?? null,
      avatarUrl: insertUser.avatarUrl ?? null,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }
}

export const storage = new MemStorage();
