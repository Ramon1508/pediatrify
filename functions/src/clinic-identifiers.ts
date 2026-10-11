/** A staff profile ID is a bounded document segment, never an email-based identity lookup.
 * Existing directories can contain periods, @ or +; authority still requires the exact Auth binding.
 * Operation, patient, appointment, session and Firebase Auth IDs retain their separate strict validation.
 * @param {unknown} value Untrusted identifier.
 * @return {boolean} Whether the value is a safe supported staff document ID.
 */
export function validStaffId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_@.+-]{1,128}$/.test(value) &&
    value !== "." && !value.includes("..") && !/^__.*__$/.test(value);
}
