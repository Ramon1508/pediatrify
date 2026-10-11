import {HttpsError} from "firebase-functions/v2/https";
import {validStaffId} from "./clinic-identifiers";

export interface StaffPrincipal {
  authUid: string;
  userId: string;
  role: "admin" | "doctor" | "assistant" | "patient";
  doctorId?: string;
  active: boolean;
  clinicSessionId?: string;
}

export interface DeletionTarget {
  userId: string;
  role: "admin" | "doctor" | "assistant";
  // For an admin/doctor this is the account's own scope ID, not a Doctor association.
  doctorId: string;
  authUid: string | null;
}

export interface DeletionOperations {
  enabled: boolean;
  resolveTarget: (userId: string) => Promise<DeletionTarget>;
  acquire: (target: DeletionTarget) => Promise<"acquired" | "completed">;
  prepareRelatedStaff: (target: DeletionTarget) => Promise<void>;
  disableAccess: (target: DeletionTarget) => Promise<void>;
  invalidatePrincipal: (target: DeletionTarget) => Promise<void>;
  deleteBusinessData: (target: DeletionTarget) => Promise<void>;
  deleteAuth: (target: DeletionTarget) => Promise<void>;
  complete: (target: DeletionTarget) => Promise<void>;
  release: (target: DeletionTarget) => Promise<void>;
}

/**
 * Executes a resumable deletion using server-owned identities only.
 * @param {unknown} data Only the business user ID is accepted from the client.
 * @param {StaffPrincipal} actor Verified identity, never request.data.
 * @param {DeletionOperations} ops Trusted adapters; disabled until P01 is ready.
 * @return {Promise<object>} Success only after Auth and business data are removed.
 */
export async function deleteStaffAccount(
  data: unknown, actor: StaffPrincipal, ops: DeletionOperations,
): Promise<{deleted: true}> {
  if (!ops.enabled) {
    throw new HttpsError("failed-precondition", "La baja definitiva todavía no está habilitada.");
  }
  if (actor.active !== true || !["admin", "doctor"].includes(actor.role) ||
      !actor.authUid || !actor.userId ||
      (actor.role === "doctor" && actor.doctorId !== actor.userId)) {
    throw new HttpsError("permission-denied", "No tienes permiso para eliminar esta cuenta.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      Object.keys(data).length !== 1 || !("userId" in data) ||
      !validStaffId(data.userId)) {
    throw new HttpsError("invalid-argument", "Indica la cuenta que deseas eliminar.");
  }
  const target = await ops.resolveTarget(data.userId);
  if (target.userId !== data.userId || !["admin", "doctor", "assistant"].includes(target.role) ||
      !validStaffId(target.doctorId) ||
      (target.role !== "assistant" && target.doctorId !== target.userId) ||
      (target.authUid !== null && (typeof target.authUid !== "string" || !target.authUid || target.authUid.length > 128 || target.authUid.includes("/")))) {
    throw new HttpsError("failed-precondition", "No se pudo verificar la identidad de la cuenta.");
  }
  const permitted = actor.role === "admin" ? ["admin", "doctor"].includes(target.role) :
    target.role === "assistant" && target.doctorId === actor.userId;
  if (!permitted || target.userId === actor.userId || target.authUid === actor.authUid) {
    throw new HttpsError("permission-denied", "No tienes permiso para eliminar esta cuenta.");
  }
  if (await ops.acquire(target) === "completed") return {deleted: true};
  try {
    await ops.prepareRelatedStaff(target);
    // Disable/revoke before any irreversible business deletion. Retain the
    // profile and immutable job binding until every step has succeeded.
    await ops.disableAccess(target);
    await ops.invalidatePrincipal(target);
    await ops.deleteBusinessData(target);
    await ops.deleteAuth(target);
    await ops.complete(target);
    return {deleted: true};
  } catch (error) {
    // A cleanup failure must neither report success nor mask the original error.
    await ops.release(target).catch(() => undefined);
    throw error;
  }
}
