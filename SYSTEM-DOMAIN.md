# Sistema — Pediatría: Dominio de negocio

## Actores del sistema

### Doctor (usuario completo)
- Usuario completo del sistema con cuenta Firebase (email + contraseña).
- Creado por invitación del admin o registro directo.
- Gestiona agenda, pacientes, citas.

### Admin (usuario completo)
- Mismos privilegios que doctor + gestión de doctores.
- Cuenta Firebase completa.

### Paciente niño (registro médico)
- **No tiene usuario del sistema.** Es solo un registro en la colección `patients` con datos del menor (nombre, fecha de nacimiento, sexo, foto, etc.).
- Cada cita (`appointments`) se liga a un `patientId` (el niño) y un `doctorId`.

### Padre / Tutor (usuario paciente con acceso)
- Es el **verdadero usuario** que accede al sistema para ver información de su hijo.
- No tiene cuenta completa del sistema. Accede vía **OTP** (código de un solo uso enviado al teléfono o correo).
- El doctor es quien crea este acceso durante el registro del paciente:
  - Define el **nombre de usuario** para login (puede ser el teléfono, el email, o ambos).
  - Define una **contraseña** generada a partir del nombre del paciente + caracteres aleatorios.
- El padre/tutor puede ver citas, historial, y en un futuro podrá agendar desde su lado.

## Reglas de negocio

### Relación paciente ↔ tutor
- Un paciente niño puede estar asociado a **hasta 2 tutores** (padre y madre, por ejemplo).
- Ambos tutores tienen el **mismo nivel de acceso** a la información del menor.

### Citas
- Toda cita pertenece a un **paciente** (niño) y un **doctor**.
- El doctor agenda la cita desde su panel de calendario.
- En un futuro el padre/tutor también podrá agendar desde su portal OTP.

### Flujo de acceso del tutor
1. El doctor registra al paciente niño en el sistema (datos del menor).
2. El doctor configura los datos de acceso del tutor (username y contraseña).
3. El tutor recibe sus credenciales (por el medio que el doctor defina).
4. El tutor inicia sesión vía OTP con el username configurado.
5. El tutor ve SOLO la información de los pacientes niños asociados a su cuenta.

## Modelo de datos (lógico)

```
patients (niños)
  ├── id, name, birthDate, sexo, photo, ...
  ├── pacienteId (único)
  └── tutores: [userId1, userId2] (máx 2)

patient_users (padres/tutores con acceso OTP)
  ├── id
  ├── username (teléfono o email)
  ├── password (hash)
  ├── pacientes: [pacienteId1, pacienteId2]
  └── tipoAcceso: 'tutor'

doctors / admin
  └── usuarios completos Firebase (Auth + Firestore)

appointments (citas)
  ├── patientId → patients
  └── doctorId → users (doctor)
```

## Notas importantes para desarrollo futuro
- El módulo OTP debe distinguir entre login de doctor/admin (completo) y login de tutor (solo ver pacientes asociados).
- Al crear un paciente, el doctor debe poder crear hasta 2 tutores con sus respectivos accesos.
- Dashboard del tutor: solo muestra pacientes vinculados a su `patientUserId`.
- El sistema debe impedir que un tutor vea información de pacientes que no le pertenecen.
