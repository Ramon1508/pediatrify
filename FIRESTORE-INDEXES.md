# Firestore Indexes

## Índices compuestos necesarios

### `appointments` — `doctorId` ASC + `disabled` ASC

Se requiere este índice compuesto para la consulta:

```
where('doctorId', '==', doctorId) + where('disabled', '==', false)
```

**Crear en Firebase Console:**
- Colección: `appointments`
- Campos: `doctorId` ASC, `disabled` ASC

### `notifications` — modelo fan-out (un doc por destinatario)

Cada notificación se crea como **un documento por destinatario** con `recipientId` y `read: boolean`. Consultas:

| Query | Colección | Índice compuesto |
|-------|-----------|------------------|
| `getPage('all')`: `recipientId == me + createdAt desc` | `notifications` | `recipientId` ASC + `createdAt` DESC |
| `getPage('unread')` y `watchUnreadCount`: `recipientId == me + read == false + createdAt desc` | `notifications` | `recipientId` ASC + `read` ASC + `createdAt` DESC |
| `markAllCancelledRead`: `recipientId == me + type == appointment-cancelled + read == false` | `notifications` | `recipientId` ASC + `type` ASC + `read` ASC |

**Crear en Firebase Console** (colección `notifications`):
1. `recipientId` ASC, `createdAt` DESC
2. `recipientId` ASC, `read` ASC, `createdAt` DESC
3. `recipientId` ASC, `type` ASC, `read` ASC

> El modelo anterior (doc compartido con `recipientIds`/`recipients[]`/`unreadFor`) quedó obsoleto: se reemplazó por fan-out para que el estado de lectura sea un `read: boolean` por destinatario (sin joins, sin desync).

### Queries actuales (single-field — índices automáticos)

| Archivo | Colección | Campo | Operador |
|---------|-----------|-------|----------|
| `admin-init.service.ts` | `users` | `email` | `==` |
| `user.repository.ts` | `users` | `firebaseUid` | `==` |
| `appointment.repository.ts` | `appointments` | `doctorId` | `==` |
| `invitation.repository.ts` | `users` | `email` | `==` |

### Historial de cambios

- **`notification.repository.ts` + `notification.service.ts`**: migración a **modelo fan-out** (un doc de `notifications` POR destinatario con `recipientId` + `read`). Adiós a `recipientIds`/`recipients[]`/`unreadFor`. Queries por igualdad (`where recipientId == me`) con los 3 índices compuestos de arriba. `createMany()` crea N docs en un `writeBatch`; `watchUnreadCount()` = `onSnapshot` + `snapshot.size` (el badge lo alimenta SOLO esta subscripción; `markAsRead`/`markCancelledRead`/`prependNew` ya no tocan `unreadCount`). Se eliminó `countUnread`/`getCountFromServer`.
- **`appointment.repository.ts`**: Se agregó `where('disabled', '==', false)` a `watchAppointmentsByDoctor`, `getAppointmentsByDoctor`, y `watchAllAppointments`. Requiere índice compuesto `doctorId` + `disabled`.
- **`invitation.repository.ts`**: Cambió de `where('email', ==) + where('pending', ==)` a solo `where('email', ==)` con filtro en memoria por `pending === true`. Esto eliminó la necesidad del índice compuesto `email` + `pending`.
- **`admin-init.service.ts`**: Igual — se eliminaron las queries compuestas `role + pending` y `email + pending` en favor de una query simple por `email`.
