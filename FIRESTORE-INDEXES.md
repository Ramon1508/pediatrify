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

### Queries actuales (single-field — índices automáticos)

| Archivo | Colección | Campo | Operador |
|---------|-----------|-------|----------|
| `admin-init.service.ts` | `users` | `email` | `==` |
| `user.repository.ts` | `users` | `firebaseUid` | `==` |
| `appointment.repository.ts` | `appointments` | `doctorId` | `==` |
| `invitation.repository.ts` | `users` | `email` | `==` |

### Historial de cambios

- **`appointment.repository.ts`**: Se agregó `where('disabled', '==', false)` a `watchAppointmentsByDoctor`, `getAppointmentsByDoctor`, y `watchAllAppointments`. Requiere índice compuesto `doctorId` + `disabled`.
- **`invitation.repository.ts`**: Cambió de `where('email', ==) + where('pending', ==)` a solo `where('email', ==)` con filtro en memoria por `pending === true`. Esto eliminó la necesidad del índice compuesto `email` + `pending`.
- **`admin-init.service.ts`**: Igual — se eliminaron las queries compuestas `role + pending` y `email + pending` en favor de una query simple por `email`.
