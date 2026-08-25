import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);
  return value;
}

type FirebaseServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function getServiceAccount() {
  const serializedAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (serializedAccount) {
    try {
      const account = JSON.parse(serializedAccount) as FirebaseServiceAccount;
      if (account.project_id && account.client_email && account.private_key) {
        return {
          projectId: account.project_id,
          clientEmail: account.client_email,
          privateKey: account.private_key,
        };
      }
    } catch {
      // Fall through to the explicit message below.
    }
    throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON 값이 올바른 서비스 계정 JSON이 아닙니다.");
  }

  return {
    projectId: requiredEnvironment("FIREBASE_ADMIN_PROJECT_ID"),
    clientEmail: requiredEnvironment("FIREBASE_ADMIN_CLIENT_EMAIL"),
    privateKey: requiredEnvironment("FIREBASE_ADMIN_PRIVATE_KEY"),
  };
}

function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const serviceAccount = getServiceAccount();

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey.replace(/\\n/g, "\n"),
    }),
    databaseURL: requiredEnvironment("NEXT_PUBLIC_FIREBASE_DATABASE_URL"),
  });
}

export function getAdminDatabase(): Database {
  return getDatabase(getAdminApp());
}
