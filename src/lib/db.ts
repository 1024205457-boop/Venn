import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "venn.db");

let db: Database.Database | null = null;

function getDb() {
  if (!db) {
    // Ensure data directory exists
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");

    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        text TEXT NOT NULL DEFAULT '',
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }
  return db;
}

export interface Project {
  id: string;
  name: string;
  text: string;
  data: string; // JSON string of VennData
  created_at: number;
  updated_at: number;
}

export function listProjects(): Project[] {
  return getDb()
    .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
    .all() as Project[];
}

export function getProject(id: string): Project | undefined {
  return getDb()
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(id) as Project | undefined;
}

export function createProject(project: Project): void {
  getDb()
    .prepare(
      "INSERT INTO projects (id, name, text, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(project.id, project.name, project.text, project.data, project.created_at, project.updated_at);
}

export function updateProject(id: string, updates: { name?: string; text?: string; data?: string }): void {
  const sets: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) { sets.push("name = ?"); values.push(updates.name); }
  if (updates.text !== undefined) { sets.push("text = ?"); values.push(updates.text); }
  if (updates.data !== undefined) { sets.push("data = ?"); values.push(updates.data); }
  sets.push("updated_at = ?");
  values.push(Date.now());
  values.push(id);

  getDb().prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteProject(id: string): void {
  getDb().prepare("DELETE FROM projects WHERE id = ?").run(id);
}
