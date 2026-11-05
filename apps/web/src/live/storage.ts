import type { Proof, TrustedDeployment } from './verification.js';

export interface SavedIssuance { proof: Proof; original: Uint8Array; altered: Uint8Array; customer?: string; deployment?: TrustedDeployment }
const DB_NAME = 'koda-sepolia-document-demo-v1';
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('evidence');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveIssuance(value: SavedIssuance) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('evidence', 'readwrite');
    tx.objectStore('evidence').put(value, 'current');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
}
export async function loadIssuance(): Promise<SavedIssuance | undefined> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction('evidence').objectStore('evidence').get('current');
    request.onsuccess = () => resolve(request.result as SavedIssuance | undefined); request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
