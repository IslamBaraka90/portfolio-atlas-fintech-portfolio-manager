import { useSyncExternalStore } from "react";
import {
  envelopeSchema,
  sessionProfileSchema,
  type SessionProfile,
} from "@portfolio-atlas/contracts";
let profile: SessionProfile | null = null;
let pending: Promise<SessionProfile> | null = null;
const listeners = new Set<() => void>();
function set(value: SessionProfile) {
  profile = value;
  listeners.forEach((fn) => fn());
  return value;
}
export const useSession = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => profile,
  );
export function currentSession() {
  return profile;
}
export function refreshSession(): Promise<SessionProfile> {
  if (pending) return pending;
  pending = fetch("/api/v1/auth/session")
    .then(async (response) => {
      if (!response.ok) throw new Error("Session status is unavailable.");
      return set(envelopeSchema(sessionProfileSchema).parse(await response.json()).data);
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}
export async function startSession(token: string) {
  const response = await fetch("/api/v1/auth/session", {
    method: "POST",
    headers: { authorization: "Bearer " + token },
  });
  if (!response.ok)
    throw new Error("The credential is invalid, expired or outside this workspace.");
  return set(envelopeSchema(sessionProfileSchema).parse(await response.json()).data);
}
export async function endSession() {
  const response = await fetch("/api/v1/auth/logout", {
    method: "POST",
    headers: { "x-csrf-token": profile?.csrf ?? "" },
  });
  if (!response.ok && response.status !== 401)
    throw new Error("Logout failed; retry before leaving this shared browser.");
  return refreshSession();
}
