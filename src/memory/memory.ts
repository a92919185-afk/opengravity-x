import { getDatabase } from "./database.js";
import { FieldValue } from "firebase-admin/firestore";

export interface Memory {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export async function saveMemory(key: string, value: string): Promise<void> {
  const db = getDatabase();
  const docRef = db.collection("memories").doc(key);
  const doc = await docRef.get();

  if (doc.exists) {
    await docRef.update({
      value,
      updated_at: FieldValue.serverTimestamp(),
    });
  } else {
    await docRef.set({
      value,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
  }
}

export async function getMemory(key: string): Promise<string | null> {
  const db = getDatabase();
  const doc = await db.collection("memories").doc(key).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data()?.value ?? null;
}

export async function deleteMemory(key: string): Promise<boolean> {
  const db = getDatabase();
  const docRef = db.collection("memories").doc(key);
  const doc = await docRef.get();

  if (doc.exists) {
    await docRef.delete();
    return true;
  }
  return false;
}

export async function listMemories(): Promise<Memory[]> {
  const db = getDatabase();
  const snapshot = await db.collection("memories").orderBy("updated_at", "desc").get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      key: doc.id,
      value: data.value,
      created_at: data.created_at?.toDate()?.toISOString() ?? "",
      updated_at: data.updated_at?.toDate()?.toISOString() ?? "",
    };
  });
}

export async function saveConversationMessage(
  userId: number,
  role: ConversationMessage["role"],
  content: string
): Promise<void> {
  const db = getDatabase();
  await db
    .collection("users")
    .doc(userId.toString())
    .collection("conversations")
    .add({
      role,
      content,
      created_at: FieldValue.serverTimestamp(),
    });
}

export async function getConversationHistory(
  userId: number,
  limit = 20
): Promise<ConversationMessage[]> {
  const db = getDatabase();
  const snapshot = await db
    .collection("users")
    .doc(userId.toString())
    .collection("conversations")
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();

  const rows = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      role: data.role as ConversationMessage["role"],
      content: data.content,
    };
  });

  // Return oldest first for the prompt context
  return rows.reverse();
}

export async function clearConversationHistory(userId: number): Promise<void> {
  const db = getDatabase();
  const batch = db.batch();

  const snapshot = await db
    .collection("users")
    .doc(userId.toString())
    .collection("conversations")
    .get();

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
}
