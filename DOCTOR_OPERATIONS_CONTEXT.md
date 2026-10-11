# DOCTOR

**Confirmación clínica externa — 10 de octubre de 2026:** el usuario comunica que el Doctor confirma las curvas de crecimiento y el esquema de vacunación actuales. P37/D11 queda cerrado por esa confirmación. No se atribuye a una prueba clínica ejecutada por el agente ni a una referencia bibliográfica no proporcionada.

**Revisión vigente: 10 de octubre de 2026 (P46/D10).** Describe el comportamiento confirmado en código y pruebas locales. El conjunto de servicios ya fue publicado y habilitado en la ventana D10 autorizada; se verificaron configuración y rutas públicas. No se ejecutaron pruebas funcionales con cuentas reales ni SMTP por decisión D09. Consultar [condiciones compartidas](SHARED_OPERATIONS_CONTEXT.md#condiciones-de-disponibilidad-para-los-futuros-manuales). No es un manual final ni contiene capturas; la auditoría inicial es histórica.

Contexto funcional para redactar posteriormente el manual del Doctor de Lilcare. Investigación estática del código local al 4 de octubre de 2026, referencia 76791ac. No es un manual final ni una prueba de funcionamiento en producción. No se capturaron screenshots ni se usaron datos reales. Consultar también [contexto compartido](SHARED_OPERATIONS_CONTEXT.md) para términos, criterios de certeza y matriz global.

## 1. Propósito del rol

**CONFIRMADO:** el Doctor administra la agenda de su consultorio, expedientes infantiles, antecedentes, vacunas y registros de consulta; prepara recetas y recomendaciones, configura su impresión y gestiona asistentes. Identificación interna: doctor.

El calendario es su pantalla inicial. No hay un dashboard clínico separado en la navegación actual. Datos por consulta y la cita son operaciones distintas: registrar un diagnóstico no completa automáticamente una cita ni reservar crea un registro clínico.

No tiene funciones normales para crear administradores o gestionar otros doctores. El acceso exclusivo al historial, vacunas, gráficas y ajustes de impresión corresponde al Doctor frente al Asistente.

Fuentes revisadas: [rutas](src/app/app.routes.ts), [menú](src/app/shared/components/sidebar/sidebar.html), [historial](src/app/pages/patient-history/patient-history.ts).

**Invitaciones/registro:** integrados con la protección de acceso y comprobados localmente; permanecen deshabilitados por defecto hasta activación del entorno. El Doctor no puede crear Administradores.

## 2. Inicio de sesión / acceso

### Primer acceso

1. El Administrador invita al Doctor con nombre y correo; el Doctor recibe un enlace o una copia manual del mismo.
2. El enlace abre Registro. Usuario y Correo electrónico vienen precargados y no se editan allí.
3. Completa datos profesionales y contraseña. Una vez que inicia sesión, puede agregar su logotipo desde Perfil.
4. Crear mi cuenta finaliza el registro y vuelve al login con «Tu cuenta ha sido creada».
5. Inicia sesión con su correo y contraseña. Con registro completo entra al Calendario; incompleto vuelve a completar perfil.

| Campo de registro | Requisito comprobado |
|---|---|
| Usuario / Correo electrónico | Lectura; vienen de la invitación |
| Sexo | Obligatorio: Masculino, Femenino u Otro |
| Teléfono | Obligatorio; exactamente diez dígitos |
| Especialidad | Opcional |
| Cédula profesional | Obligatoria |
| Cédula de especialidad | Opcional |
| Consultorio(s) | Obligatorio, texto |
| Contraseña | Obligatoria; mínimo ocho caracteres, mayúscula, minúscula, número y símbolo |
| Confirmar contraseña | Debe coincidir |
| Logotipo | En registro por invitación se agrega posteriormente desde Perfil; el formulario público no sube archivos |

La invitación tiene siete días de vigencia desde su emisión y se usa para completar una sola cuenta. El registro valida el enlace antes de mostrar el formulario; si caducó, fue usado o reemplazado, solicita una nueva invitación al Administrador. Reenviar invalida el enlace previo y conserva el mismo pendiente. Enlaces antiguos solo con correo no permiten completar registro. Crear mi cuenta se bloquea con errores, formulario intacto o solicitud activa.

### Acceso habitual y recuperación

- Login de personal: Correo electrónico y Contraseña → Iniciar sesión. El icono de ojo muestra/oculta la contraseña.
- Error de credenciales: «Correo o contraseña incorrectos». Puede intentar enviar un formulario incompleto y recibir errores; el botón se bloquea mientras procesa.
- Olvidé mi contraseña → correo → Recuperar contraseña → revisar correo → enlace → nueva contraseña y confirmación → Restablecer contraseña. El sistema vuelve a login.
- Mensajes: «Correo de recuperación enviado. Revisa tu bandeja de entrada.»; «Contraseña restablecida correctamente. Inicia sesión con tu nueva contraseña.»; enlace expirado/no válido solicita uno nuevo.
- El personal tiene cierre por inactividad de una hora en la lógica actual. No hay una pantalla dedicada de aviso previo confirmada.

**Mobile:** los botones del login se apilan y ocupan el ancho disponible; el registro usa un formulario adaptable. **Estado de certeza:** CONFIRMADO en código; entrega efectiva de invitaciones/recuperación y tiempos de entrega requieren validación del entorno.

Fuentes revisadas: [login](src/app/pages/login/login.ts), [registro](src/app/pages/setup-profile/setup-profile.ts), [registro visible](src/app/pages/setup-profile/setup-profile.html), [recuperación](src/app/pages/reset-password/reset-password.ts), [sesión](src/app/core/services/auth.service.ts).

## 3. Pantalla inicial

El Calendario muestra encabezado Lilcare o logo propio del Doctor, campana con contador y botón de cuenta. Tiene navegación principal, selector de fecha, Configuración y Agendar consulta.

- **Desktop/tablet:** cuadrícula semanal de domingo a sábado, filas de horas y bloques de consultas. Días/horas fuera de disponibilidad se distinguen visualmente. La franja de fechas abre el selector de fecha. Hoy aparece cuando la semana elegida no es la actual.
- **Mobile:** vista del día seleccionado y tarjetas con hora/paciente; al tocar una tarjeta se abre su detalle. No es la misma cuadrícula reducida. Configuración y Agendar se conservan como dos botones en una fila adaptable.
- **Detalle de consulta:** nombre, motivo cuando existe, Reagendar, Cancelar y Ver historial. La hora se identifica en la cuadrícula o tarjeta; no se muestra aquí un campo de correo de quien actualizó.
- **Sin reservas en móvil:** «No tienes consultas agendadas para este día.», referido a la fecha seleccionada.
- Existe carga de configuración y skeleton en la zona de cuadrícula desktop; no se comprobó una variante equivalente visible en toda la vista móvil.

La navegación por fechas utiliza el selector del encabezado y Hoy; no hay selección de otro Doctor desde esta pantalla.

Fuentes revisadas: [calendario](src/app/pages/calendar/calendar.html), [acciones de calendario](src/app/pages/calendar/calendar.ts), [detalle](src/app/shared/components/appointment-detail-card/appointment-detail-card.html).

## 4. Navegación principal

| Nombre mostrado | Propósito / destino | Mobile |
|---|---|---|
| Calendario | Agenda, reservas y configuración semanal | Barra inferior; agenda por día |
| Pacientes | Consultas del día, búsqueda y expedientes | Barra inferior; tarjetas adaptables |
| Asistentes | Invitar y gestionar asistentes del Doctor | Barra inferior; no cambia el alcance |
| Impresión | Formato de recetas/recomendaciones y logo | Barra inferior; vista previa como pestaña, edición en panel inferior |
| Campana | Notificaciones | Abre página completa en lugar de ventana superior derecha |
| Icono de cuenta | Perfil y Cerrar sesión | Abre página de perfil; edición en panel inferior |
| Marca del encabezado | Volver a la entrada de la agenda | Misma finalidad |

Ver historial se encuentra en tarjetas/menús de pacientes y en el detalle de cita. El breadcrumb Pacientes del historial regresa al listado. No hay entrada a Bitácora ni a una página separada de Consultas/Walk-in en el menú actual.

Fuentes revisadas: [menú](src/app/shared/components/sidebar/sidebar.html), [encabezado](src/app/shared/components/header/header.ts), [rutas](src/app/app.routes.ts).

## 5. Funciones disponibles

### 5.1 Consultar calendario y elegir una fecha

**Objetivo:** revisar reservas y disponibilidad de una semana o día.

**Cómo llegar:** Calendario; es también la entrada posterior al login.

**Pasos:**

1. Pulsa la fecha del encabezado.
2. Elige una fecha en el calendario emergente.
3. Revisa su semana en desktop o su día en móvil.
4. Pulsa Hoy cuando esté disponible para volver a la semana actual.
5. Abre una consulta para revisar el detalle.

**Campos:** fecha de navegación; permite consultar periodos anteriores, a diferencia del selector de una nueva reserva. Los datos de tarjetas son lectura.

**Acciones:** elegir fecha cambia la vista; pulsar bloque/tarjeta abre detalle; cerrar detalle regresa a agenda; Ver historial abre el expediente del paciente.

**Resultado esperado:** cambia la fecha presentada sin modificar reservas.

**Validaciones:** las celdas fuera de los segmentos no se ofrecen como inicio normal de una reserva. Elegir una fecha para navegar no implica que se pueda agendar allí.

**Mensajes / estados especiales:** disponibilidad en gris; vista vacía según sección 8. No hay una acción visible de marcar atendida en este calendario.

**Mobile:** tarjetas por día; detalle dentro de la presentación móvil.

**Dependencias con otros roles:** reservas de asistentes/pacientes aparecen en la agenda del doctor asociado.

**Estado de certeza:** CONFIRMADO; actualización entre sesiones requiere prueba funcional.

Fuentes revisadas: [calendar.html](src/app/pages/calendar/calendar.html), [calendar.ts](src/app/pages/calendar/calendar.ts).

### 5.2 Agendar consulta desde Calendario o historial

**Objetivo:** crear una reserva para un paciente existente o darlo de alta mientras se agenda.

**Cómo llegar:** Calendario → Agendar consulta, o pulsar celda disponible; también Pacientes → Ver historial → Datos por consulta → Agendar consulta. El botón Agendar del empty state de consultas del día abre la misma operación en Calendario.

**Pasos:**

1. Abre el formulario.
2. Desde Calendario, escribe en Buscar paciente y selecciona un resultado.
3. Elige Día.
4. Elige Hora.
5. Escribe motivo si corresponde.
6. Revisa advertencias y pulsa Agendar.

**Campos:**

| Campo | Requisito / comportamiento |
|---|---|
| Buscar paciente | Obligatorio seleccionar una opción; busca por nombre/apellidos únicamente entre pacientes asignados al Doctor. Desde historial se muestra fijo; no permite sustituirlo |
| Día | Obligatorio; selector restringido por disponibilidad y fechas |
| Hora | Obligatoria; lista según día y duración |
| Motivo de consulta (opcional) | Texto, máximo visible de cien caracteres y contador |

**Acciones:** Agendar crea; X cierra sin guardar ni confirmación de descarte. + Añadir nuevo paciente cambia al alta dentro del mismo panel; flecha de regreso vuelve al formulario conservado. Tras crear al niño se autoselecciona, pero todavía hay que pulsar Agendar.

**Resultado esperado:** «Cita agendada», cierre del formulario y aparición de la reserva en calendario; se generan avisos a los participantes.

**Validaciones:** no pasado, días cerrados o hoy sin horas futuras; hoy solo horas posteriores a la hora actual del centro de México, aunque el dispositivo esté en otra zona; la duración debe caber en cada segmento. Las opciones de un formulario abierto se actualizan al cambiar el minuto y guardar vuelve a comprobar día/hora. Si el día ya no tiene horarios, indica «Selecciona un día con horarios disponibles del consultorio.». La fecha/hora elegida se guarda como la del consultorio. El Doctor puede elegir hora ocupada: la advertencia no bloquea la superposición. No hay una aprobación posterior independiente.

Al agendar o reagendar, cambiar Día conserva la Hora solo si sigue disponible para esa fecha; de lo contrario la limpia y debes seleccionar otra. Antes de guardar se recalculan las horas, también si la elegida para hoy ya pasó durante la edición. Una hora fuera de segmentos, desalineada con la duración o que no permita completar la consulta impide guardar y muestra «Selecciona una hora disponible dentro del horario del doctor para el día elegido.». CONFIRMADO en P21; fuentes: `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`, `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.spec.ts`.

**Mensajes / estados especiales:** «Ya existe una cita agendada en esta fecha y hora. La nueva cita se sobrepondrá a la existente.»; «El día seleccionado no está disponible para citas. Elige un día dentro del horario del doctor.»; error de guardado dentro del formulario. Escribir un nombre sin elegir resultado no completa la selección.

**Selección de paciente:** después de elegir un resultado, editar o borrar el texto limpia la selección y bloquea Agendar hasta elegir otro resultado, incluso si se vuelve a escribir el mismo nombre. Muestra «Selecciona un paciente de los resultados de búsqueda.». Enfocar o desplegar el buscador conserva la selección. El paciente recién creado se selecciona automáticamente al volver del alta. Desde historial y al reagendar, el paciente permanece fijo. CONFIRMADO en P24; fuentes: `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`, su template y sus pruebas.

**Mobile:** panel inferior; nuevo paciente se muestra dentro de ese panel, no en un segundo drawer. Campos pueden envolver según ancho.

**Dependencias con otros roles:** Doctor y Asistente pueden reservar; Paciente solo cuando se habilita y en horas libres. El alta durante la reserva puede enviar correo de acceso aunque aún no se confirme la cita.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [reserva](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts), [campos](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.html), [disponibilidad](src/app/core/utils/availability.ts), [entrada desde historial](src/app/pages/patient-history/patient-history.ts).

### 5.3 Reagendar o cambiar el motivo de una consulta

**Objetivo:** actualizar una reserva existente.

**Cómo llegar:** Calendario → consulta → Reagendar.

**Pasos:**

1. Abre detalle.
2. Pulsa Reagendar.
3. Modifica día, hora o motivo.
4. Pulsa Reagendar en el formulario.

**Campos:** paciente fijo; día/hora obligatorios; motivo opcional hasta cien caracteres. Datos existentes precargados.

**Acciones:** Reagendar guarda; X abandona el formulario. No cambia el niño asociado ni crea una consulta clínica.

**Resultado esperado:** «Cita actualizada» y reserva actualizada. Cambiar fecha u hora genera aviso de reagenda; cambiar solo el motivo no genera ese aviso.

El Doctor puede conservar fecha/hora y cambiar solo el motivo. En el portal del Paciente también se permite conservarlas sin contar la propia cita como ocupación; otra reserva vigente a la misma hora sí lo bloquea. Para personal sigue aplicando la advertencia de superposición, sin convertirla en un bloqueo. Actualización local P20; fuente: `src/app/pages/calendar/calendar.ts` y pruebas en `src/app/pages/calendar/calendar.spec.ts`.

**Validaciones:** conservar exactamente fecha/hora original permite corregir solo motivo aunque el horario haya cambiado, el día esté cerrado o la cita sea pasada. Elegir otra fecha/hora exige disponibilidad actual. Superposición del personal conserva advertencia; otra cita vigente bloquea al Paciente. No permite reactivar una cita cancelada/deshabilitada.

**Mensajes / estados especiales:** mismos errores de disponibilidad/guardado de la operación anterior.

**Mobile:** selecciona el día, pulsa la tarjeta de consulta para desplegar el detalle y después Reagendar. Se cierra el detalle y se abre el mismo formulario en un panel inferior, con paciente fijo y datos precargados. Guarda para actualizar o pulsa X para conservar la reserva sin cambios. Mantiene las validaciones de desktop.

**Dependencias con otros roles:** el cambio afecta la agenda compartida y notifica a asistentes/familia.

**Estado de certeza:** CONFIRMADO para desktop y mobile en el código actual; conexión mobile verificada con pruebas de interacción P18. Capturas y validación visual en dispositivos reales pendientes.

Fuentes revisadas: [enlaces de acciones](src/app/pages/calendar/calendar.html), [detalle](src/app/shared/components/appointment-detail-card/appointment-detail-card.ts), [guardado](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts).

### 5.4 Cancelar una consulta

**Objetivo:** retirar una reserva de la agenda habitual sin eliminar al paciente o sus registros médicos.

**Cómo llegar:** Calendario → consulta → Cancelar; también Pacientes → consulta del día → Cancelar.

**Pasos:**

1. Pulsa Cancelar.
2. Lee «Cancelar consulta» y la explicación de aviso al tutor.
3. Acepta la cancelación o cancela la confirmación.

**Campos:** ninguno adicional; la confirmación identifica el contexto de la cita.

**Acciones:** confirmar cambia la reserva a cancelada; cancelar/cerrar la confirmación conserva la reserva. No hay una selección automática de nueva fecha.

**Resultado esperado:** «Cita cancelada», desaparición de la reserva de la vista habitual y aviso de cancelación.

El horario de una cancelada vuelve a estar libre para el portal del Paciente si no hay otra cita vigente en esa fecha/hora y la disponibilidad del Doctor lo permite. La cancelada tampoco produce una advertencia de superposición al crear otra reserva; no se agenda una sustitución automáticamente. Actualización local P19 del 9 de octubre de 2026. Fuentes: `src/app/pages/calendar/calendar.ts`, `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`.

**Validaciones:** no se encontró una ventana mínima de anticipación o un motivo obligatorio de cancelación. No afirmar reglas de penalización.

**Mensajes / estados especiales:** la explicación indica que el tutor será notificado y podrá reservar otra consulta si está permitido; el fallo de aviso no revierte la cancelación.

**Mobile:** acción de cancelación sí conectada en el detalle móvil; modal de confirmación adaptable.

**Dependencias con otros roles:** asistentes también cancelan; el Paciente puede hacerlo cuando el doctor habilita operaciones de reserva.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [calendario y confirmación activa](src/app/pages/calendar/calendar.ts), [consultas del día](src/app/pages/patients/patients.ts).

### 5.5 Configurar disponibilidad, segmentos y reservas del Paciente

**Objetivo:** definir cuándo pueden agendarse consultas y si la familia puede hacerlo por sí misma.

**Cómo llegar:** Calendario → Configuración.

**Pasos:**

1. Elige duración.
2. Ajusta Permitir que los pacientes agenden citas.
3. Selecciona un día semanal.
4. Añade, ajusta o elimina sus segmentos.
5. Repite para los otros días.
6. Guarda configuración.

**Campos:** duración de 10, 15, 30, 45, 60 o 120 minutos; interruptor de reservas del Paciente; días Lun/Mar/Mié/Jue/Vie/Sáb/Dom; Inicio/Fin de cada segmento como hora.

**Acciones:** chip selecciona el día que se edita; su check significa que tiene segmentos, no que el clic abra/cierre el día. + Añadir nuevo segmento añade por defecto 06:00–00:00. Eliminar o X de un segmento lo retira del borrador; sin confirmación. Guardar configuración aplica; Cancelar/X cierra sin guardar.

**Resultado esperado:** «Configuración guardada»; calendario/opciones de reserva usan los días y segmentos guardados. Cambiar lunes no debe copiar automáticamente su edición a martes: el borrador maneja días separados.

**Cerrar toda la semana:** elimina todos los segmentos de cada día y pulsa Guardar configuración. Se permite guardar sin ningún día abierto. Al reabrir, los días siguen sin segmentos y no se ofrecen fechas/horas para nuevas reservas. Para volver a abrir, añade un segmento al día correspondiente y guarda. Cerrar disponibilidad no cancela las citas existentes ni cambia por sí solo Permitir que los pacientes agenden citas. CONFIRMADO en el código y autorizado en P25; fuentes: `src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts`, `src/app/pages/calendar/calendar.ts`, `src/app/pages/calendar/p25-closed-week.spec.ts`.

**Validaciones:** duración obligatoria y positiva. Inicio y Fin de cada segmento son obligatorios, en formato de 24 horas HH:mm. Fin debe ser posterior a Inicio; Fin 00:00 representa final del día, por lo que 22:00–00:00 es válido y 00:00–00:00 representa el día completo. Dos segmentos del mismo día no pueden superponerse ni duplicarse; sí pueden ser consecutivos (09:00–12:00 y 12:00–14:00), estar separados por un hueco o usar las mismas horas en días distintos. No se reordenan ni corrigen automáticamente. Una consulta se ofrece cuando cabe completa antes del Fin del segmento.

Si hay errores, el aviso «Corrige los horarios indicados antes de guardar.» identifica día, número de segmento y acción requerida, incluso si estás editando otro día. Selecciona el día indicado para corregirlo o elimina el segmento. Guardar configuración queda bloqueado mientras haya errores, no se hayan hecho cambios o se esté guardando; solo recorrer los días no cuenta como modificación. Eliminar todos los segmentos sigue permitido. CONFIRMADO en P26; fuentes: `src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts`, su template y sus pruebas.

**Mensajes / estados especiales:** «Error al guardar configuración». Una cuenta sin configuración utiliza valores por defecto: lunes–sábado, 06:00–00:00 y treinta minutos.

**Mobile:** panel inferior; chips envuelven; Inicio/Fin pueden conservar fila si el ancho lo permite. No hay gestión especial de festivos o cierre de una fecha aislada.

**Dependencias con otros roles:** el Asistente puede guardar días, segmentos y duración del doctor asociado. Solo el Doctor ve y modifica Permitir que los pacientes agenden citas; el guardado del Asistente conserva esa elección. El interruptor controla reservas del Paciente, no las del personal. Las reservas ya existentes no se cancelan por cambiar horario.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [ajustes](src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts), [interfaz](src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.html), [disponibilidad](src/app/core/utils/availability.ts).

### 5.6 Buscar pacientes y revisar consultas del día

**Objetivo:** localizar un expediente o acceder a las reservas de hoy.

**Cómo llegar:** Pacientes.

**Pasos:**

1. Revisa Consultas del día de hoy.
2. Busca en «Buscar por paciente, padre o tutor».
3. Localiza tarjeta.
4. Pulsa Ver historial o menú de tres puntos.

**Campos:** búsqueda libre por nombre/apellidos del niño, padre o madre; no se confirmó búsqueda por correo o teléfono. Tarjetas con nombre, edad y padres/tutores.

**Acciones:** Ver historial abre expediente; Completar perfil para básicos o Editar paciente para completos; Regenerar contraseña; Eliminar paciente. La consulta del día permite historial/cancelación; Agregar paciente abre alta.

**Resultado esperado:** filtrado del listado y navegación al expediente seleccionado.

**Validaciones:** solo Doctor tiene esta página en el flujo normal. No se ofrece un filtro médico/por fecha de nacimiento.

**Mensajes / estados especiales:** sin pacientes y sin consultas tienen mensajes/CTA de sección 8; búsqueda sin coincidencias no tiene un mensaje específico identificado.

**Mobile:** tarjetas y carrusel de consultas se adaptan; no existe una tabla móvil distinta para el directorio.

**Dependencias con otros roles:** el alta hecha por Asistente debe aparecer como expediente del Doctor. Los tutores verán los niños que compartan su acceso.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [pacientes](src/app/pages/patients/patients.ts), [vista](src/app/pages/patients/patients.html), [tarjeta](src/app/shared/components/patient-card/patient-card.html).

### 5.7 Añadir paciente y habilitar su acceso

**Objetivo:** crear un expediente básico y una contraseña para el portal de su familia.

**Cómo llegar:** Pacientes → Agregar paciente; también Calendario → Agendar consulta → + Añadir nuevo paciente.

**Pasos:**

1. Introduce datos del niño y contacto.
2. Usa las sugerencias de padres/tutores si corresponde.
3. Pulsa Añadir paciente.
4. Si aparece el aviso de correo compartido, verifica la asociación familiar y pulsa Continuar.
5. Si aparece el aviso de nombre coincidente, revisa los datos y pulsa Continuar si deseas crear otro expediente; requiere confirmación independiente del correo.
6. Tras aceptar el último aviso se guarda automáticamente. Confirma que se creó y revisa si el correo de acceso se envió.

**Campos:**

| Campo | Obligatorio / validación |
|---|---|
| Nombre completo | Sí; el sistema lo reparte para mostrar nombre/apellidos. Revisar nombres compuestos después |
| Fecha de nacimiento | Sí, fecha |
| Correo electrónico principal | Sí, formato de correo; se usa para enviar acceso |
| Correo secundario | Opcional, formato de correo cuando se llena; también puede servir para entrar |
| Padre o tutor / Madre o tutora | Ambos requeridos en el alta actual |
| Teléfono | Sí; exactamente diez dígitos |

Las sugerencias familiares pueden completar pareja/correo/teléfono cuando faltan; no necesariamente sustituyen valores ya capturados.

**Acciones:** Añadir paciente guarda; X cierra sin confirmar descarte. En alta embebida, flecha/X vuelve a la cita; guardar vuelve con el niño seleccionado.

**Resultado esperado:** expediente básico y contraseña generada por el sistema. Se intenta enviar el acceso a los correos principal y secundario guardados, una sola vez si coinciden. La alerta de alta no muestra la contraseña: «Paciente creado. Se envió el acceso a los correos guardados.». Para consultarla después, el Doctor usa el menú del paciente → Ver contraseña. No reproducir contraseñas en el manual o screenshots.

**Validaciones:** requeridos/correos/teléfono; detección de posible duplicado por datos según el padrón recibido. Compartir correo puede ser correcto para hermanos; no equivale automáticamente a duplicar niño.

**Actualización local P23 — CONFIRMADO:** los avisos se comprueban dentro de la agenda del Doctor, cruzando correo principal/secundario con ambos contactos registrados. Correo y nombre se confirman por separado; Añadir paciente permanece deshabilitado mientras hay un aviso pendiente y Continuar exige datos válidos. Cambiar nombre o correos invalida las confirmaciones y requiere volver a pulsar Añadir paciente para comprobarlos. Cambiar solo teléfono no repite una coincidencia ya aceptada. Guardar está deshabilitado con formulario inválido, sin cambios o durante la petición; una segunda pulsación durante guardado no crea otra petición. Un error de guardado se muestra por separado y no tiene Continuar. Fuentes: `src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.ts`, `src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.html`, `src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.spec.ts`.

**Mensajes / estados especiales:** durante el envío: «Enviando acceso a los correos guardados…». Si un destino falla, se indica «Correo principal/secundario: envío confirmado/no confirmado». El paciente ya está creado: Reintentar envío conserva el expediente y la contraseña y solo vuelve a intentar destinos pendientes; Continuar con el paciente vuelve a la cita o al listado sin exigir entrega confirmada. No repetir el alta para reenviar. Durante creación/envío se bloquean la captura y el cierre.

**Mobile:** panel inferior; en reserva se sustituye el contenido del mismo panel y hay flecha de regreso.

**Dependencias con otros roles:** tutor no se registra por sí mismo; recibe acceso del consultorio. Asistente puede realizar este mismo alta únicamente desde la reserva.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [alta](src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.ts), [campos](src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.html), [envío](src/app/core/services/email.service.ts).

### 5.8 Completar el perfil inicial del paciente

**Objetivo:** pasar del expediente básico a antecedentes, contacto y esquema de vacunas completos.

**Cómo llegar:** Pacientes → menú del paciente incompleto → Completar perfil; también menú del paciente en su historial.

**Pasos:**

1. Captura datos generales.
2. Pulsa Siguiente.
3. Completa contactos.
4. Pulsa Siguiente.
5. Marca vacunas conocidas.
6. Guarda el perfil.

**Campos:**

| Grupo | Campos y reglas |
|---|---|
| Identificación | Nombre completo y fecha de nacimiento requeridos; Sexo visible Masculino/Femenino |
| Nacimiento | Tipo de sangre A+/A−/B+/B−/AB+/AB−/O+/O−; peso y talla al nacer obligatorios, números mayores que cero; PC al nacer opcional y mayor que cero cuando se llena; tipo de nacimiento Parto/Cesárea |
| Antecedentes | Respuesta Sí/No obligatoria para alergias, hospitalización, enfermedad y medicamentos. Si Sí, explicación obligatoria; cambiar a No limpia la explicación |
| Contacto | Correo principal válido, teléfono principal y nombres de padre/madre obligatorios |
| Opcionales | Correo secundario válido, teléfono secundario, Recomendado por |
| Recomendado por | Autocompletado de pacientes existentes. Una entrada libre no seleccionada se limpia al salir; no es un campo libre de cualquier recomendador |
| Vacunas | Marca aplicada/no aplicada en dosis disponibles; no es obligatorio completar todas |

**Acciones:** Siguiente valida el paso; Anterior regresa sin guardar definitivamente; guardar persiste todo; X cierra sin confirmación de descarte.

**Resultado esperado:** «Perfil del paciente guardado.» y expediente completo; menú pasa a la edición correspondiente.

**Validaciones:** requeridos y dependencias Sí/No. Medidas aceptan decimales positivos; cero y negativos no son válidos. Nacimiento no puede ser posterior al día actual del consultorio. Teléfono principal: diez dígitos. No se imponen límites clínicos máximos inventados.

**Mensajes / estados especiales:** errores instructivos bajo campos; un opcional con correo incorrecto puede bloquear el guardado final. La información no se guarda automáticamente al cambiar de paso.

**Mobile:** pasos en panel inferior; vacunas como filas por vacuna/dosis; campos generales se ajustan por ancho.

**Dependencias con otros roles:** operación del Doctor; ni Asistente ni Paciente tienen esta edición. El portal no muestra todos estos antecedentes.

**Estado de certeza:** CONFIRMADO.

Fuentes revisadas: [completar](src/app/pages/patients/dialogs/complete-profile-dialog/complete-profile-dialog.ts), [formulario](src/app/pages/patients/dialogs/complete-profile-dialog/complete-profile-dialog.html).

### 5.9 Consultar y editar el perfil del paciente

**Objetivo:** revisar/corregir identificación, antecedentes, contactos y vacunas.

**Cómo llegar:** Pacientes → menú → Editar paciente; o historial → menú del niño → ver perfil / edición.

**Pasos:**

1. Abre el perfil.
2. En lectura revisa Datos generales, Datos de contacto y Esquema de vacunación.
3. Pulsa editar si entraste en lectura.
4. Cambia datos.
5. Guarda cambios.

**Campos:** mismos grupos del perfil completo. Correo principal requerido y válido; teléfono principal requerido de diez dígitos; al menos uno de padre/tutor o madre/tutora debe quedar capturado al editar (alta/completado exigen ambos). Nacimiento no futuro y medidas positivas; PC al nacer opcional, borrarlo guarda ausencia de valor. Recomendado por conserva selección de paciente existente.

**Acciones:** cambiar pestaña en lectura es libre; en edición puede bloquearse si la pestaña actual tiene errores. Guardar persiste y vuelve a lectura sin cerrar necesariamente el panel. Cancelar desde lectura→edición restaura datos y vuelve a lectura; desde una entrada directa de edición puede cerrar. X cierra sin confirmación.

**Resultado esperado:** mensaje interno «Cambios del perfil guardados.»; datos actualizados. No hay un historial visible de versiones previas de perfil.

**Validaciones:** requeridos generales/antecedentes y formatos actuales. «No hay cambios que guardar» si se intenta guardar sin modificaciones. «Campos requeridos pendientes en: ... Completa los campos obligatorios.» al tratar de cambiar pestaña inválida.

**Mensajes / estados especiales:** éxito temporal dentro del panel y error de guardado; vista de lectura presenta valores en texto y casillas no editables.

**Mobile:** panel inferior, pestañas y formulario adaptable; esquema usa alternativa por vacuna. El modo de lectura sigue siendo lectura.

**Dependencias con otros roles:** solo Doctor en navegación normal; cambios de correo afectan cómo la familia accede y se agrupa, pero no son un cambio de contraseña del tutor.

**Estado de certeza:** CONFIRMADO; actualización inmediata de tarjetas/listado tras cerrar depende de la entrada y merece comprobarse al capturar el flujo.

Fuentes revisadas: [perfil de paciente](src/app/pages/patients/dialogs/edit-patient-dialog/edit-patient-dialog.ts), [modos](src/app/pages/patients/dialogs/edit-patient-dialog/edit-patient-dialog.html).

### 5.10 Consultar y actualizar esquema de vacunación

**Objetivo:** registrar si las dosis del esquema incorporado han sido aplicadas.

**Cómo llegar:** Completar perfil → último paso; o perfil del paciente → Esquema de vacunación → modo edición.

**Pasos:**

1. Identifica vacuna y edad.
2. En lectura revisa las marcas existentes.
3. En edición marca/desmarca dosis.
4. Guarda el perfil para persistirlas.

**Campos:** casilla aplicada/no aplicada en los cruces admitidos; no hay campos visibles de fecha de aplicación, lote, marca comercial, aplicador o reacción.

| Vacuna en UI | Edades disponibles en el código |
|---|---|
| BCG | Al nacer |
| Hepatitis B | Al nacer |
| Hexavalente | 2, 4, 6 y 18 meses |
| DPaT | 4–6 años |
| Rotavirus monovalente | 2 y 4 meses |
| Rotavirus pentavalente | 2, 4 y 6 meses |
| Neumococo conjugada | 2, 4, 6 y 12 meses |
| Virus de influenza | 6 meses, 7 meses y Anual |
| Covid-19 ARNm | 6 meses y Anual |
| Sarampión, Rubéola y Parotiditis | 12 y 18 meses |
| Varicela | 12 y 18 meses |
| Hepatitis A | 12 y 18 meses |
| Meningococo ACYW | 9 y 12 meses |
| Neumococo Polisacáridos | 2 años |

Esta tabla describe controles del sistema; no certifica un calendario sanitario oficial ni sustituye una indicación médica.

**Acciones:** checkbox cambia el borrador; guardar perfil confirma; cancelar descarta. Cruces sin dosis no tienen una casilla operable.

**Resultado esperado:** mismas marcas al volver a abrir el perfil. Anual es una única marca, no una lista de aplicaciones por año.

**Validaciones:** no es obligatorio marcar ninguna/todas las dosis; no existe validación de aplicación contra edad real identificada.

**Mensajes / estados especiales:** sin marcas no significa necesariamente falta de vacunación: puede ser información no capturada. No hay un empty state ni aviso de vencimiento propio del esquema.

**Mobile:** listado por vacuna y dosis; desktop tabla desplazable horizontal con columna Vacuna fija. Lectura tiene casillas deshabilitadas, edición permite pulsarlas.

**Dependencias con otros roles:** el Asistente y el Paciente no tienen pantalla de vacunas en su navegación actual.

**Estado de certeza:** CONFIRMADO como interfaz; correspondencia con protocolo clínico NO DETERMINABLE DESDE EL CÓDIGO.

Fuentes revisadas: [esquema en completar](src/app/pages/patients/dialogs/complete-profile-dialog/complete-profile-dialog.ts), [esquema editable/lectura](src/app/pages/patients/dialogs/edit-patient-dialog/edit-patient-dialog.html).

### 5.11 Regenerar contraseña de acceso del Paciente

**Objetivo:** entregar un nuevo acceso cuando el tutor pierde u olvida su contraseña.

**Cómo llegar:** Pacientes → menú del niño → Regenerar contraseña.

**Pasos:**

1. Verifica que sea el expediente correcto.
2. Pulsa Regenerar contraseña.
3. Revisa la alerta y el resultado del envío a ambos contactos guardados.
4. Informa al tutor por el canal autorizado si el correo falla.

**Campos:** no solicita una contraseña elegida por el Doctor. Solo se generan contraseñas del sistema; no hay edición manual para ningún rol. Son seis caracteres y únicas entre los accesos activos del sistema.

**Acciones:** regeneración directa, sin confirmación previa; sustituye la contraseña del expediente y trata de enviar acceso.

**Resultado esperado:** «Contraseña renovada. Acceso enviado a los correos guardados.». La contraseña previa deja de permitir acceso para ese expediente y las sesiones ligadas a ella se invalidan. La nueva se consulta separadamente con Ver contraseña; no se muestra en la alerta de regeneración.

**Validaciones:** correo existente y operación de actualización/envío; no se exige cambio al primer uso del tutor.

**Mensajes / estados especiales:** «Contraseña renovada, pero faltan envíos por confirmar. Vuelve a pulsar Regenerar para reintentar el envío sin cambiarla.». En ese intento conservado, Regenerar reintenta el envío pendiente sin generar otra contraseña. Error incierto de renovación: «No se pudo confirmar la renovación. Reintenta la operación.». No existe recuperación autónoma del portal por Olvidé mi contraseña.

**Mobile:** menú de tarjeta y alerta temporal adaptados; misma operación.

**Dependencias con otros roles:** el tutor necesita el nuevo valor para ese expediente; los otros hijos conservan sus propias contraseñas. El Asistente no tiene este menú.

**Estado de certeza:** CONFIRMADO.

Fuentes revisadas: [regeneración](src/app/pages/patients/patients.ts), [acceso de pacientes](src/app/core/services/auth.service.ts), [correo](src/app/core/services/email.service.ts).

### 5.12 Eliminar un paciente

**Objetivo:** retirar definitivamente el expediente y sus registros asociados.

**Cómo llegar:** Pacientes → menú → Eliminar paciente; también menú del niño en Historial.

**Pasos:**

1. Selecciona Eliminar paciente.
2. Lee que se eliminará el historial y que los tutores pueden perder acceso salvo que tengan otro paciente asociado.
3. Confirma o cancela.

**Campos:** no se pide motivo, reescritura de nombre ni contraseña.

**Acciones:** Eliminar paciente borra; Cancelar/cerrar conserva. No hay papelera, recuperar o deshacer accesibles.

**Resultado esperado:** se eliminan paciente, datos por consulta y citas asociados; se retira del listado y, desde historial, se vuelve a Pacientes.

**Validaciones:** confirmación previa; no comprobación adicional de dependencia familiar visible para que el usuario decida.

**Mensajes / estados especiales:** explicación destructiva, éxito/error. La eliminación de registros no debe describirse como eliminación de toda notificación, archivo o cuenta externa asociada.

**Mobile:** confirmación modal; contenido puede envolver, misma consecuencia.

**Dependencias con otros roles:** afecta consulta del tutor y agenda compartida; un hermano aún asociado puede mantener acceso familiar.

**Estado de certeza:** CONFIRMADO en borrado de expediente, registros y citas.

Fuentes revisadas: [confirmación](src/app/pages/patients/patients.ts), [historial](src/app/pages/patient-history/patient-history.ts), [alcance del borrado](src/app/core/services/cascade.service.ts).

### 5.13 Consultar historial y Datos por consulta

**Objetivo:** revisar la evolución del paciente y los documentos de una fecha clínica.

**Cómo llegar:** Pacientes → Ver historial; o Calendario → detalle de cita → Ver historial.

**Pasos:**

1. Revisa identificación, edad y tutores.
2. En Datos por consulta elige Fecha de la consulta.
3. Cambia entre Datos y diagnóstico, Recomendaciones, Receta y Gráficas.
4. Usa Editar o Imprimir en el contexto correspondiente.

**Campos:** fecha seleccionada, medidas (PC, peso, talla, IMC, saturación, temperatura), motivo, diagnóstico, notas; texto y límites de visibilidad de documentos. La edad de una consulta puede diferir de la edad actual de la tarjeta.

**Acciones:** selector cambia registro presentado, no su fecha; Agendar consulta fija este paciente; Añadir entrada abre nueva consulta; menú del paciente abre perfil/edición/eliminación. No hay botón normal de borrar una entrada clínica.

**Resultado esperado:** lectura del registro elegido; la selección inicial favorece la fecha más reciente.

**Validaciones:** acceso Doctor; no exige que exista una cita para registrar una entrada. No se vincula automáticamente una entrada a una reserva ni se marca atendida.

**Mensajes / estados especiales:** «Aún no se han agregado datos por consultas de este paciente» con Añadir entrada. Los documentos vencidos pueden seguir visibles para el Doctor; el límite afecta al portal.

**Mobile:** página de historial con secciones/pestañas adaptables; formularios en panel inferior. Los datos pueden envolver; no es un expediente simplificado de paciente.

**Dependencias con otros roles:** Asistente no tiene Ver historial ni acceso a esta pantalla. Paciente tiene una vista distinta y menor del historial.

**Estado de certeza:** CONFIRMADO.

Fuentes revisadas: [historial](src/app/pages/patient-history/patient-history.ts), [pantalla](src/app/pages/patient-history/patient-history.html).

### 5.14 Añadir datos de una consulta clínica

**Objetivo:** registrar medidas, diagnóstico y documentos de la atención actual.

**Cómo llegar:** Historial → Datos por consulta → Añadir entrada.

**Pasos:**

1. Completa Datos y diagnóstico.
2. Pulsa Siguiente.
3. Define vigencia de Recomendaciones y escribe el contenido si aplica.
4. Pulsa Siguiente.
5. Define vigencia de Receta y escribe contenido si aplica.
6. Pulsa Guardar e imprimir.

**Campos:**

| Campo | Requisito / comportamiento |
|---|---|
| Fecha de consulta / edad | Fecha actual y edad presentada; no se ofrece cambiar la fecha para cargar una atención pasada |
| Circunferencia / PC | Obligatorio, número decimal, cm |
| Peso | Obligatorio, número decimal, kg |
| Talla | Obligatoria, número decimal, cm |
| IMC | Cálculo de peso/talla; lectura |
| Saturación | Obligatoria, número decimal, % |
| Temperatura | Obligatoria, número decimal, °C |
| Motivo de consulta | Obligatorio, texto |
| Diagnóstico | Obligatorio, texto |
| Notas | Opcional |
| Visible para el paciente hasta — recomendaciones | Fecha obligatoria, hoy o posterior al crear |
| Recomendaciones | Editor enriquecido; no se exige texto no vacío |
| Visible para el paciente hasta — receta | Fecha obligatoria, hoy o posterior al crear |
| Receta | Editor enriquecido; no se exige texto no vacío |

Editor: estilos de texto, listas, títulos, colores, enlaces e imágenes. La presencia de esos controles no valida contenido médico ni genera automáticamente una receta.

**Acciones:** Siguiente valida el paso; Anterior regresa; X cierra sin confirmación. El último paso solo ofrece **Guardar e imprimir**; no un Guardar separado para una entrada nueva.

**Resultado esperado:** entrada registrada, «Entrada agregada» y nueva pestaña/vista de impresión. Cancelar el diálogo del navegador de impresión no deshace el registro ya guardado.

**Validaciones:** números no negativos en formato decimal, requeridos y fechas de vigencia. Los campos numéricos permiten cero. Recomendaciones y receta pueden estar vacías aunque sus fechas sean obligatorias.

**Mensajes / estados especiales:** «Permite ventanas emergentes para imprimir». Si la ventana no puede abrirse, el camino Guardar e imprimir se detiene antes de persistir; no prometer que se guarda de todos modos. Errores de guardado aparecen como alertas.

**Mobile:** pasos en panel inferior; teclado y scroll interno. Impresión sigue dependiendo de soporte del navegador/dispositivo.

**Dependencias con otros roles:** solo Doctor registra; tutor podrá leer contenido vigente según selección del portal, no diagnóstico/notas/medidas completos.

**Estado de certeza:** CONFIRMADO; impresión física y controles del navegador REQUIEREN VALIDACIÓN por dispositivo.

Fuentes revisadas: [consulta clínica](src/app/pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.ts), [campos/acciones](src/app/pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.html), [editor](src/app/shared/components/rich-text-editor/rich-text-editor.ts).

### 5.15 Editar una consulta, recomendaciones o receta

**Objetivo:** corregir un registro existente o sus documentos y vigencia.

**Cómo llegar:** Historial → elegir Fecha de la consulta → Editar en Datos y diagnóstico, Recomendaciones o Receta.

**Pasos:**

1. Selecciona fecha correcta.
2. Abre Editar en la sección deseada.
3. Cambia campos/contenido.
4. Guarda o guarda e imprime según las acciones realmente ofrecidas.

**Campos:** mismos de la entrada; edición general agrupa los tres contextos, edición parcial muestra el documento pertinente. Fecha/edad no son una herramienta de reagenda. Fechas de vigencia antiguas pueden mantenerse al editar.

**Acciones:** edición general ofrece Guardar y Guardar e imprimir; edición parcial de Recomendaciones/Receta ofrece **solo Guardar e imprimir**, aunque el título sea «Editar datos de la consulta». X abandona sin confirmación.

**Resultado esperado:** «Entrada actualizada», cierre del formulario y actualización del registro. En impresión parcial se imprime la sección correspondiente.

**Validaciones:** edición parcial valida su sección, no obliga a corregir medidas de otra pestaña. Edición general valida todos los grupos. Guardar e imprimir requiere ventana emergente.

**Mensajes / estados especiales:** error de validación o alerta de ventana emergente; no hay control de aprobación de cambios, comparación de versiones ni borrado de entrada accesible.

**Mobile:** formulario inferior; mismas diferencias de botones por origen.

**Dependencias con otros roles:** cambios de texto/visibilidad cambian lo que el tutor puede consultar; no se encontró aviso de campana específico por editar documentos.

**Estado de certeza:** CONFIRMADO.

Fuentes revisadas: [edición](src/app/pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.ts), [botones según contexto](src/app/pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.html).

### 5.16 Consultar gráficas de crecimiento

**Objetivo:** visualizar medidas registradas a lo largo del tiempo.

**Cómo llegar:** Historial → elegir fecha → Gráficas.

**Pasos:**

1. Elige consulta.
2. Selecciona la gráfica disponible para la edad.
3. Usa Acercar/Alejar.
4. Imprime si existen datos.

**Campos:** puntos derivados de peso, talla, circunferencia e IMC de registros hasta la fecha seleccionada. No se editan medidas directamente en la gráfica.

**Acciones:** chips/pestañas de Peso y talla / Circunferencia en menores de hasta 36 meses; Estatura y peso para mayores; IMC desde 24 meses. Acercar/Alejar cambia visualización. Imprimir aparece cuando hay datos.

**Resultado esperado:** gráfica con puntos y plantilla de referencia; seleccionar una fecha antigua excluye registros posteriores de esa vista.

**Validaciones:** disponibilidad por edad y datos. El gráfico se elige según sexo registrado; no hay interpretación automática clínica confirmada que deba enseñarse como diagnóstico.

**Mensajes / estados especiales:** puede verse la plantilla sin puntos y sin Imprimir.

**Mobile:** gráfica con controles de zoom y espacio adaptable; puede requerir desplazamiento. Los rótulos de las plantillas pueden estar en inglés.

**Dependencias con otros roles:** ni Asistente ni Paciente acceden a estas gráficas desde sus menús.

**Estado de certeza:** CONFIRMADO en selección/controles; validez clínica e interpretación de percentiles aprobada NO DETERMINABLE DESDE EL CÓDIGO.

Fuentes revisadas: [gráficas](src/app/pages/patient-history/components/growth-charts/growth-charts.ts), [controles](src/app/pages/patient-history/components/growth-charts/growth-charts.html).

### 5.17 Imprimir documentos de consulta y gráficas

**Objetivo:** obtener en papel, o mediante las opciones del navegador, los documentos registrados.

**Cómo llegar:** Guardar e imprimir al crear/editar; Historial → Recomendaciones/Receta → Imprimir; Gráficas → Imprimir.

**Pasos:**

1. Elige registro/contexto.
2. Pulsa la acción de impresión.
3. Permite la ventana/pestaña nueva.
4. Revisa contenido y opciones del navegador.
5. Confirma impresión o cancela allí.

**Campos:** el Doctor no recaptura datos al imprimir. Usa contenido, paciente, datos profesionales, medidas y configuración guardada según el camino. Documentos generales pueden incluir páginas separadas; receta/recomendaciones individuales imprimen su sección. Las gráficas se imprimen por su propia acción.

**Acciones:** Imprimir prepara y abre impresión; Guardar e imprimir además persiste previamente el registro; cancelar en el navegador no revierte datos.

**Resultado esperado:** documento con formato del Doctor cuando ese flujo usa sus ajustes; cédula profesional y de especialidad comparten una fila si ambas se muestran. PDF depende de la opción del navegador, no de un botón propio de exportación PDF confirmado.

**Validaciones:** ventanas emergentes, registro disponible y datos guardados. La vista de impresión de un registro exige una sesión de Doctor y que el paciente esté asignado a ese Doctor. La vigencia de publicación para el Paciente no limita la impresión del Doctor propietario. No se comprueba que los márgenes sean adecuados para cada impresora.

**Mensajes / estados especiales:** alerta de permiso de popup; la vista previa muestra «El registro no está disponible para esta cuenta.» si el registro no está disponible para el Doctor. Si falla la carga: «No fue posible cargar la impresión. Intenta abrirla nuevamente.» Existen varios caminos de impresión; no asumir que todos tienen exactamente los mismos datos o número de páginas.

**Mobile:** mismas acciones, resultado depende del diálogo de impresión del navegador móvil; capturar aparte si forma parte del uso aprobado.

**Dependencias con otros roles:** Paciente imprime solo contenido visible en un formato diferente, Carta vertical sin logo. Asistente/Administrador no tienen las funciones clínicas de impresión.

**Estado de certeza:** CONFIRMADO en generación; resultado físico, paginación final y equivalencia de caminos REQUIEREN VALIDACIÓN.

Fuentes revisadas: [impresión de secciones](src/app/pages/patient-history/patient-history.ts), [guardar e imprimir](src/app/pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.ts), [vista previa](src/app/pages/print-preview/print-preview.ts), [gráficas](src/app/pages/patient-history/components/growth-charts/growth-charts.ts).

### 5.18 Ajustar impresión, datos incluidos y logo

**Objetivo:** personalizar documentos de recetas/recomendaciones.

**Cómo llegar:** Impresión → «Ajustes de impresión de recetas y recomendaciones» → Editar.

**Pasos:**

1. Revisa vista previa.
2. Abre edición.
3. Configura Márgenes y estilos.
4. Revisa Logo.
5. En Información elige qué datos mostrar.
6. Pulsa Guardar cambios.

**Campos:**

| Pestaña | Opciones visibles |
|---|---|
| Márgenes y estilos | Tamaño Media carta, Carta, Oficio o Personalizado; Orientación Horizontal/Vertical; ancho/altura en cm cuando es personalizado; márgenes Superior/Inferior/Izquierdo/Derecho en cm |
| Logo | Usar logo Precargado; selección de imagen si se desmarca durante edición; Eliminar; posición arriba izquierda/derecha; ancho 3 o 5 cm |
| Información — Doctor | Mostrar nombre, especialidad, cédula profesional, cédula de especialidad, teléfono, consultorio(s) |
| Información — Paciente | Mostrar nombre, fecha de consulta, edad, peso, talla, perímetro cefálico, temperatura |

**Acciones:** Editar habilita controles; cambios actualizan borrador/vista previa; Guardar cambios aplica; Cancelar descarta. Subir/reemplazar/eliminar logo aquí queda pendiente de Guardar. No existe un botón propio de imprimir una consulta desde la página de ajustes.

**Resultado esperado:** «Configuración guardada correctamente» y formato persistido. Vista previa usa datos de ejemplo, no identifica un paciente seleccionado.

**Validaciones:** imagen PNG/JPG/JPEG/SVG hasta 1 MB en Impresión; dimensiones personalizadas con mínimo indicado de 1 cm y márgenes con mínimo indicado de 0 cm.

**Mensajes / estados especiales:** «Error al guardar la configuración». Los ajustes del logo se revisan en la pestaña Logo.

**Mobile:** pestaña Preview integrada además de las otras tres en lectura; Editar abre panel inferior con las tres pestañas de edición y pie de guardar. Desktop tiene vista previa junto a controles. Cancelar/cerrar no exige confirmación de descarte.

**Dependencias con otros roles:** los datos profesionales provienen del perfil del Doctor. Su logo se utiliza en su encabezado y en los documentos configurados.

**Estado de certeza:** CONFIRMADO en código y pruebas locales. Usar logo Precargado utiliza la marca de Lilcare; desmarcar utiliza el logo guardado del Doctor, con marca como fallback si no existe. La captura y el resultado físico de impresión se validarán en el ambiente publicado.

Fuentes revisadas: [ajustes de impresión](src/app/pages/impresion/impresion.ts), [opciones](src/app/pages/impresion/impresion.html), [edición móvil](src/app/pages/impresion/dialogs/print-settings-dialog/print-settings-dialog.ts).

### 5.19 Invitar y gestionar asistentes

**Regla de invitación local P13:** correo existente/reservado no genera otro Asistente. Administrar y reenviar se limita a los Asistentes del Doctor. Enlace de un uso/siete días; el Asistente solo establece contraseña/confirmación, sin escoger Doctor o rol. Servicio pendiente de activar. Fuentes: `src/app/core/services/staff-invitation.service.ts`, `functions/src/staff-invitations.ts`.

**Objetivo:** habilitar colaboradores del consultorio y mantener sus datos.

**Cómo llegar:** Asistentes.

**Pasos:**

1. Busca por nombre si procede.
2. Agregar asistente abre Invitar asistente.
3. Introduce nombre y correo y crea invitación.
4. Revisa el envío; si no se confirma, pulsa Reintentar envío o copia el enlace. El reintento conserva destinatario y enlace y no crea otro Asistente.
5. Desde tres puntos usa Reenviar invitación, Editar asistente o Eliminar asistente.

**Campos:** invitación: Nombre completo obligatorio y Correo electrónico válido obligatorio; sin selector de rol ni contraseña. La edición permite corregir nombre (obligatorio, hasta 200 caracteres) y correo (obligatorio, válido, hasta 254). No solicita contraseñas nuevas. Nombre solo usa el guardado existente; correo conserva cuenta, contraseña y asociación al Doctor mediante servicio preparado, todavía pendiente de activación/prueba integrada.

**Acciones:** Crear invitación registra y trata de enviar; después nombre/correo quedan de lectura. Ante fallo aparece Reintentar envío sobre el mismo registro/enlace. Copiar confirma copia o muestra error; Cerrar regresa y queda bloqueado durante petición. Reenviar desde directorio abre un panel con nombre/correo de lectura; al confirmar conserva la cuenta pendiente y emite un enlace nuevo de siete días, invalidando el anterior. Reintentar envío en ese panel utiliza el enlace recién emitido sin renovarlo. Guardar cambios actualiza nombre o, tras activar el servicio, nombre/correo; para invitación pendiente pide reenviar al nuevo correo. Al editar al Asistente se conserva la sesión del Doctor. Eliminar abre confirmación con Cancelar y Eliminar asistente.

**Baja del Asistente:** cuando el servicio de baja está habilitado, confirmar elimina su acceso, perfil y recursos privados, incluida su bandeja de avisos; conserva los pacientes, información clínica y citas de la agenda del Doctor y los avisos de otros destinatarios sobre esas citas. Durante la petición muestra «Eliminando…», deshabilita ambos botones y bloquea el cierre. Solo anuncia éxito tras confirmación completa; ante fallo conserva el diálogo para reintentar. Implementación local confirmada, activación/prueba integrada pendientes; no presentar como operación ya validada en producción.

**Resultado esperado:** Asistente pendiente en listado propio y enlace disponible. El panel distingue correo en curso, confirmado o sin confirmación; fallo de envío conserva enlace y reintento. El Asistente termina registro con contraseña y entra al Calendario del Doctor. Enviar confirmado no prueba recepción/lectura del correo.

**Validaciones:** invitación: nombre obligatorio/no solo espacios/hasta 200 caracteres, correo obligatorio/válido/hasta 254; Crear bloqueado por inválido/intacto/carga. No doble envío simultáneo desde el panel. Búsqueda por nombre en directorio.

**Mensajes / estados especiales:** «No has agregado ningún asistente» con Agregar asistente; alertas de invitación, actualización o eliminación.

**Mobile:** listado de tarjetas, invitación/edición en panel inferior y confirmación modal; nombres largos pueden envolver.

**Dependencias con otros roles:** Doctor invita; Asistente finaliza su propio acceso y puede editar nombre/correo propios (correo requiere activar servicio); Administrador no gestiona asistentes desde su directorio. El Asistente no puede invitar a otro colaborador.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [directorio](src/app/pages/doctors/doctors.ts), [invitación](src/app/pages/doctors/dialogs/invite-doctor-dialog/invite-doctor-dialog.ts), [edición](src/app/pages/doctors/dialogs/edit-doctor-dialog/edit-doctor-dialog.html), [eliminación](src/app/pages/doctors/dialogs/delete-doctor-dialog/delete-doctor-dialog.ts).

### 5.20 Consultar y gestionar notificaciones

**Objetivo:** conocer altas, cancelaciones y cambios de horario de consultas.

**Cómo llegar:** campana del encabezado.

**Pasos:**

1. Abre campana.
2. Elige Todos o Sin leer.
3. Desplázate para cargar más.
4. Pulsa Ver detalles en una consulta activa o Marcar todas como leídas si deseas limpiar pendientes.

**Campos:** título, descripción con paciente/día/hora, indicador de lectura y contador del encabezado; filtros Todos/Sin leer.

**Acciones:** abrir/filtrar/scroll no marca todos; Ver detalles marca ese aviso y abre **Calendario enfocado en la cita**, no historial. La acción masiva marca todos sin confirmación. Cerrar abandona la lista y marca cancelaciones como leídas.

**Resultado esperado:** contador actualizado por destinatario. Las acciones propias pueden figurar en Todos, ya leídas desde su creación; los demás destinatarios comienzan sin leer.

**Validaciones:** cancelaciones no muestran Ver detalles; una cita eliminada/deshabilitada puede perder ese enlace cuando se resuelve. No hay un enlace para borrar una notificación individual.

**Mensajes / estados especiales:** «Aún no tienes notificaciones.»; «No tienes notificaciones sin leer.»; «Has llegado al final de tus notificaciones.»; fallo de lectura masiva pide intentar de nuevo. Cerrar marca las cancelaciones como leídas.

**Mobile:** página completa; volver con el control del encabezado. Desktop ventana superior derecha con lista desplazable, filtros y título fijos.

**Dependencias con otros roles:** Doctor, asistentes y familia reciben avisos; Administrador no. Generar aviso no condiciona el éxito de la reserva. No se identificó recordatorio automático previo ni push.

**Estado de certeza:** CONFIRMADO.

Fuentes revisadas: [avisos](src/app/shared/components/notifications-dialog/notifications-dialog.ts), [lista](src/app/shared/components/notifications-dialog/notifications-dialog.html), [campana](src/app/shared/components/notification-bell/notification-bell.ts), [reglas de destinatarios](src/app/core/services/notification.service.ts).

### 5.21 Ver/editar perfil propio, logo y cerrar sesión

**Objetivo:** mantener datos profesionales usados en pantalla/documentos y finalizar acceso.

**Cómo llegar:** icono de cuenta → Perfil.

**Pasos:**

1. Revisa nombre/correo y datos profesionales.
2. Editar perfil.
3. Ajusta datos o imagen.
4. Guarda cambios o cancela.
5. Cerrar sesión cuando termines.

**Campos:** Doctor(a) requerido; sexo; teléfono; especialidad; cédulas; consultorio; logo; correo de lectura. La edición no aplica todas las obligaciones del registro inicial: teléfono no tiene el mismo patrón de diez dígitos y otros profesionales pueden quedar vacíos.

**Acciones:** enlace de logo abre imagen en otra pestaña; elegir PNG/JPG/JPEG/SVG hasta 1 MB, reemplazar o retirar archivo; Guardar cambios sube el archivo y confirma datos; Cancelar vuelve a lectura. Cerrar sesión abre Login. No hay cambio de contraseña ni edición del correo propio aquí: recuperación es un flujo separado y el correo lo gestiona un Administrador.

**Resultado esperado:** «Cambios guardados.» y perfil actualizado. Logo se usa en encabezado propio y documentos que aplican configuración del Doctor.

**Validaciones:** nombre requerido, restricciones del archivo; no todos los campos tienen validación profesional o clínica. Actualización local del 8 de octubre de 2026: Guardar cambios se deshabilita por formulario inválido, intacto o guardado en curso. Subir/retirar logo cuenta como modificación del formulario.

**Mensajes / estados especiales:** los datos opcionales ausentes pueden omitirse en lectura. Perfil e Impresión muestran una vista previa local antes de guardar; cancelar sin guardar no sube el archivo elegido. Una subida confirmada seguida de fallo de guardado se conserva para reintentar sin volver a subir. El logo anterior sigue siendo el confirmado hasta guardar correctamente.

**Mobile:** página de lectura y edición en panel inferior; Cancelar de desktop no se muestra de igual manera en edición móvil, usar cierre del panel según control disponible. No se encontró confirmación obligatoria al abandonar cambios.

**Dependencias con otros roles:** Administrador corrige el nombre del Doctor desde su directorio; el Doctor mantiene sus datos profesionales y logo.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [perfil](src/app/shared/components/profile-dialog/profile-dialog.ts), [controles](src/app/shared/components/profile-dialog/profile-dialog.html), [archivo](src/app/shared/components/file-upload/file-upload.ts), [encabezado](src/app/shared/components/header/header.ts).

## 6. Flujos completos

| Flujo | Secuencia confirmada y variantes |
|---|---|
| Incorporación del Doctor | Administrador invita → correo/enlace → Registro completo → Crear mi cuenta → login → Calendario |
| Atención de paciente nuevo | Pacientes → Agregar → alta básica/acceso → Completar perfil → historial → Añadir entrada → medidas/diagnóstico → recomendaciones → receta → Guardar e imprimir |
| Reserva desde calendario | Calendario → Agendar o celda válida → seleccionar paciente → Día → Hora → motivo opcional → Agendar |
| Reserva con alta embebida | Agendar → Añadir nuevo paciente → guardar paciente → regreso con selección → completar Día/Hora → Agendar. Crear paciente y crear cita son dos confirmaciones distintas |
| Reserva desde expediente | Pacientes → Ver historial → Agendar consulta → paciente fijo → Día/Hora → Agendar |
| Cambio/cancelación | Calendario → detalle → Reagendar (desktop/mobile) y guardar; o Cancelar → confirmación → retirada de agenda |
| Seguimiento clínico | Pacientes → historial → elegir fecha → Datos/Recomendaciones/Receta/Gráficas → Editar según contexto → guardar/guardar e imprimir |
| Consulta de familia | Doctor guarda documento con fecha límite → tutor inicia Acceso paciente → Pacientes → Ver historial → documento vigente; no necesariamente todas las fechas |
| Habilitar colaborador | Asistentes → Agregar → nombre/correo → invitación → Asistente define contraseña → agenda compartida |
| Personalizar impresión | Perfil profesional completo → Impresión → Editar formato/logo/datos → guardar → historial → impresión de un documento real |

No agregar al manual un paso de aprobar cita del Paciente, marcar atendida desde este calendario, exportar expediente completo, firmar digitalmente, eliminar entrada clínica o guardar nueva entrada sin imprimir: no hay acción normal verificada para ello.

## 7. Responsive / mobile

| Área | Desktop | Tablet | Mobile hasta 768 px |
|---|---|---|---|
| Navegación | Lateral, cuatro áreas | Conserva navegación con menos espacio | Barra inferior con cuatro áreas |
| Calendario | Semana domingo–sábado | Cuadrícula con espacio reducido | Día/tarjetas; selector de fecha; detalle móvil |
| Agenda/configuración | Panel derecho | Mismo panel adaptable | Panel inferior, scroll interno; botones superiores en fila |
| Reagendar | Detalle → formulario con paciente fijo | Mismo formulario adaptable | Tarjeta → detalle → Reagendar → panel inferior precargado |
| Alta en cita | Sustituye formulario del mismo panel | Igual | Mismo panel con flecha de regreso |
| Pacientes/asistentes | Tarjetas y búsqueda | Tarjetas envuelven | Tarjetas adaptables; no tabla universal |
| Perfil de paciente | Panel derecho y pestañas | Espacio reducido | Panel inferior; lectura/edición diferenciadas |
| Vacunas | Tabla con desplazamiento y primera columna fija | Puede conservar tabla | Listado por vacuna/dosis |
| Consulta clínica | Wizard o edición por pestañas | Campos se ajustan | Panel inferior; campos pueden conservar filas según ancho |
| Perfil propio | Modal de lectura/edición | Modal | Página de lectura y panel de edición |
| Impresión | Ajustes con preview lateral | Menos espacio | Preview como pestaña; editor en panel inferior |
| Notificaciones | Ventana superior derecha | Adaptable | Página completa |
| Confirmaciones | Modal central | Modal | Modal adaptable, no siempre pantalla completa |

Hay reglas adicionales para anchos de 400/320 px y paisaje, pero no una experiencia de tablet independiente para cada flujo. Revisar nombres largos, teclado abierto, footers y scroll al capturar, sin suponer que todo se apila en una columna.

Fuentes revisadas: [global](src/styles.scss), [calendario](src/app/pages/calendar/calendar.scss), [vacunas](src/app/pages/patients/dialogs/edit-patient-dialog/edit-patient-dialog.scss), [impresión](src/app/pages/impresion/impresion.scss), [menú](src/app/shared/components/sidebar/sidebar.scss).

## 8. Empty states

| Lugar | Mensaje / presentación | Acción disponible / efecto |
|---|---|---|
| Pacientes, sin expedientes | «No has agregado ningún paciente.» | Agregar paciente → alta básica |
| Consultas de hoy | «No tienes consultas agendadas para el día de hoy.» | Agendar → Calendario con formulario abierto |
| Calendario móvil sin reservas | «No tienes consultas agendadas para este día.» | Agendar del encabezado o elegir otra fecha |
| Calendario desktop sin días configurados | «Selecciona días disponibles en Configuración para ver el calendario.» | Configuración; el mensaje pertenece a la cuadrícula oculta en móvil |
| Historial sin entradas | «Aún no se han agregado datos por consultas de este paciente» | Añadir entrada → wizard clínico; Agendar es operación distinta |
| Asistentes | «No has agregado ningún asistente» | Agregar asistente → invitación |
| Notificaciones Todos | «Aún no tienes notificaciones.» | Cambiar filtro/cerrar; no crear aviso manual |
| Notificaciones Sin leer | «No tienes notificaciones sin leer.» | Todos muestra leídas si existen |
| Gráficas sin puntos | Plantilla sin datos superpuestos; Imprimir no aparece | Capturar medidas en una consulta, no en la gráfica |
| Logo ausente | Área Subir archivo o imagen de marca por defecto según pantalla | Subir en perfil/registro o seleccionar en edición de Impresión |
| Búsqueda sin coincidencias | Tarjetas no mostradas; no mensaje especial identificado | Cambiar/borrar búsqueda; no significa padrón inexistente |

La ausencia de mensajes de error al cargar puede confundirse con ausencia de datos en algunas áreas; no atribuir una causa solo por el empty state.

## 9. Confirmaciones y acciones destructivas

| Acción | Confirmación | Aceptar | Cancelar / cerrar |
|---|---|---|---|
| Cancelar cita | Sí: Cancelar consulta y aviso a tutor | Cancela reserva, no historial | Conserva cita |
| Eliminar paciente | Sí: historial/acceso familiar afectados | Borra expediente, entradas y citas | Conserva datos |
| Eliminar asistente | Sí | Borra registro y elementos ligados al asistente | Conserva asistente |
| Regenerar contraseña del niño | No | Sustituye inmediatamente y envía correo | No hay un paso previo de cancelación |
| Marcar avisos como leídos | No | Cambia lectura individual/masiva | Abrir/filtrar no marca todo; cierre sí marca cancelaciones |
| Eliminar segmento | No | Solo borrador hasta guardar | Cancelar configuración descarta |
| Eliminar/reemplazar logo en Impresión | Sin confirmación dedicada | Pendiente de guardar | Cancelar descarta el borrador |
| Sustituir archivo en perfil/registro autenticado | Sin confirmación dedicada | Preview local; subida al guardar | Cancelar antes de guardar descarta selección |
| Cerrar alta/consulta/edición con X | Generalmente no | Abandona borrador | No enseñar una alerta universal de cambios pendientes |
| Cancelar impresión del navegador | Diálogo propio del navegador | No imprime | No revierte el registro ya guardado |

## 10. Estados read-only y editables

- Registro inicial: nombre/correo de invitación fijos; profesional y contraseña editables.
- Perfil propio: lectura inicial; Editar habilita datos profesionales, pero correo sigue fijo.
- Perfil de paciente: modo de lectura distinto de edición; vacunas no operables en lectura. Requeridos no idénticos entre alta, completar y editar.
- Agendar desde Calendario: paciente seleccionable; desde historial: fijo. Reagendar: siempre fijo.
- Fecha de navegar Calendario puede ser pasada; fecha de reservar no. Fecha de nueva consulta clínica es hoy de lectura.
- IMC de consulta se calcula; no se captura como medida libre.
- Editor clínico parcial valida solo su documento. Editor general valida los tres grupos.
- Impresión está en lectura hasta Editar; vista previa muestra datos de muestra.
- Controles de guardado suelen bloquearse mientras procesan, pero no todos se deshabilitan por formulario inválido/prístino. No inferir la regla desde una recomendación de diseño.

## 11. Validaciones

| Contexto | Reglas comprobadas / límites |
|---|---|
| Acceso/recuperación | Correo válido, contraseña requerida; nueva contraseña fuerte y confirmación iguales |
| Registro Doctor | Diez dígitos de teléfono, cédula/consultorio/sexo requeridos; invitación no sube logo, se agrega después desde Perfil |
| Perfil Doctor | Nombre requerido, correo fijo; validaciones más permisivas que registro |
| Alta niño | Nombre/nacimiento no futuro/correo/ambos tutores/teléfono requeridos; diez dígitos; secundario opcional válido |
| Completar niño | Antecedentes Sí/No, descripciones si Sí; medidas positivas, PC opcional; ambos tutores/correo principal/teléfono requeridos; selección real en Recomendado por |
| Editar niño | Correo principal/teléfono requeridos, al menos un tutor; medidas positivas; pestaña con errores puede impedir cambiar; sin cambios muestra aviso |
| Vacunas | Solo cruces existentes; no fecha/lote ni obligatoriedad global |
| Reserva | Día y hora requeridos, no pasado, hoy futuro, dentro de segmentos; motivo máximo cien en UI; superposición permitida al personal con aviso |
| Configuración | Duración obligatoria y segmentos por día |
| Consulta clínica | Medidas decimales, motivo y diagnóstico requeridos; notas opcionales; fechas de visibilidad requeridas |
| Invitación de asistente | Nombre requerido y correo válido |
| Impresión | PNG/JPG/JPEG/SVG hasta 1 MB; controles indican mínimos de dimensiones/márgenes |

Mensajes representativos: «Ingresa un correo electrónico válido», «Selecciona la fecha límite de visualización», «Las contraseñas no coinciden», «Completa los campos obligatorios», además de los específicos de cada operación. No completar mensajes que el código no proporciona con un texto inventado.

## 12. Estados de carga y error

- Login/recuperación: spinner en botón y bloqueo mientras procesa.
- Listados: indicadores de carga; calendario carga configuración. Carga inicial no es prueba de sincronización permanente de todos los datos.
- Formularios de pacientes, registro, reservas y consultas: guardado en curso, botón bloqueado y spinner según template; errores bajo campos, dentro de formulario o alertas temporales según el caso.
- Notificaciones: tres skeletons iniciales, spinner al cargar más, lectura masiva con bloqueo. Scroll carga automáticamente, no un botón «Reintentar» general.
- Perfil: spinner al guardar; snackbar propio de éxito. Impresión: bloqueo mientras guarda y alerta de éxito/error.
- Invitación/paciente creado y correo fallido: creación permanece; copiar enlace o regenerar acceso son operaciones distintas de repetir alta.
- Ventana emergente bloqueada: impresión puede detener Guardar e imprimir antes de guardar. No tratarla como mero aviso cosmético.
- No se identificó modo offline de operaciones, guardado en cola visible ni recuperación automática de conflictos. Tampoco un mensaje universal de permisos fallidos.

## 13. Notificaciones

Disponible para Doctor. Tipos confirmados: consulta agendada, cancelada y reagendada. Contienen paciente/día/hora y estado de lectura propio. También pueden resultar de su propia acción. Sin recordatorios automáticos ni notificaciones push confirmados.

Abrir no limpia contador; Ver detalles marca y enfoca Calendario. Marcar todas cambia todo sin confirmar. Cerrar marca cancelaciones como leídas. Citas canceladas no tienen detalles; citas inexistentes/deshabilitadas pueden perder el enlace. Desktop usa ventana; mobile página completa. Ver operación 5.20 y reglas compartidas.

## 14. Perfil

Doctor tiene lectura y edición propia, además de cerrar sesión. Nombre/correo y datos existentes visibles; campos opcionales pueden omitirse. Correo no editable; contraseña no se cambia en perfil. Logo enlazable/subible/retirable: PNG/JPG/JPEG/SVG hasta 1 MB, igual que Impresión. Elegir un archivo muestra una vista previa local; Guardar realiza la subida y confirma el perfil. Cancelar antes de guardar descarta la selección. El logo confirmado se comparte con el encabezado y los formatos de impresión del Doctor.

Editar perfil no equivale a editar el expediente del niño ni la cuenta de un asistente. Ver 5.21.

## SCREENSHOTS RECOMENDADOS PARA EL MANUAL

- [ ] Ver contraseña: carga, lectura/copia y error con Reintentar; valor de acceso oculto, desktop/mobile.
- [ ] Alta: envío confirmado a ambos contactos, fallo parcial y Reintentar envío/Continuar con el paciente; desktop/mobile, correos ficticios.
- [ ] Regeneración confirmada y reintento de entrega sin nueva contraseña; sin revelar acceso.
- [ ] Perfil e Impresión: preview local antes de guardar, logo confirmado y fallback de marca; desktop/mobile.
- [ ] Reagenda conservando horario original con semana cerrada; edición de motivo sin mover la cita.

- [ ] Agendar: paciente elegido, texto editado con selección retirada y mensaje de elegir resultado; desktop/mobile.

- [ ] Registro Doctor por invitación sin upload y con indicación de agregar logotipo desde Perfil: desktop/mobile.
- [ ] Enlace caducado, usado o inválido y acción Ir a iniciar sesión, usando datos ficticios.
- [ ] Panel Reenviar invitación de Asistente con identidad de lectura, aviso de siete días y reintento/copia: desktop/mobile; enlace ficticio o invalidado.

- [ ] Login y validación de credenciales; desktop/mobile.
- [ ] Registro Doctor con campos profesionales y logo; desktop/mobile.
- [ ] Calendario con reservas y días grises; semana desktop y día mobile.
- [ ] Selector de fecha y vuelta con Hoy.
- [ ] Detalle de consulta con acciones; desktop/mobile.
- [ ] Reagendar con paciente fijo y datos precargados: panel desktop y panel inferior mobile.
- [ ] Agendar desde Calendario con selector de paciente y advertencia de superposición.
- [ ] Agendar desde historial con paciente fijo.
- [ ] Alta de paciente embebida y flecha de regreso; desktop/mobile.
- [ ] Confirmación de cancelar consulta.
- [ ] Configuración con dos segmentos distintos y días cerrados; desktop/mobile.
- [ ] Configuración con los siete días sin segmentos y reapertura tras guardar; desktop/mobile.
- [ ] Configuración con campo vacío, orden incorrecto y solapamiento; aviso de error de otro día y corrección que habilita Guardar. Desktop/mobile.
- [ ] Pacientes con consultas del día y búsqueda por tutor; desktop/mobile.
- [ ] Empty states sin pacientes y sin consultas.
- [ ] Alta básica con validaciones, usando correos ficticios.
- [ ] Aviso de correo compartido → Continuar → aviso de nombre coincidente → Continuar; desktop/mobile y alta embebida. No mostrar contraseñas en el resultado.
- [ ] Completar perfil: generales, contactos y antecedentes condicionales.
- [ ] Perfil del niño en lectura y edición; desktop/mobile.
- [ ] Vacunas: tabla desktop y listado mobile; lectura y edición.
- [ ] Regeneración con contraseña visualmente ocultada; no fotografiar valores reales.
- [ ] Confirmación de eliminar paciente.
- [ ] Historial sin entradas y con selector de fecha; desktop/mobile.
- [ ] Nueva consulta: medidas/diagnóstico, recomendaciones y receta.
- [ ] Diferencia entre edición general y edición parcial (botones al pie).
- [ ] Gráficas con datos/zoom e impresión; desktop/mobile.
- [ ] Documento de receta, recomendaciones y salida completa con datos ficticios.
- [ ] Impresión: lectura/edición, Márgenes y estilos, Logo, Información; Preview móvil por separado.
- [ ] Asistentes con datos y empty state.
- [ ] Invitación enviando/confirmada/fallida, enlace manual y Reintentar envío; desktop/mobile, con enlace ficticio.
- [ ] Reintento confirmado y campos bloqueados tras crear la invitación.
- [ ] Editar asistente (nombre) y confirmación de borrado; corrección de nombre.
- [ ] Notificaciones Todos/Sin leer, contador, cancelación sin enlace y lectura masiva; desktop/mobile.
- [ ] Perfil propio lectura/edición/logo y Cerrar sesión; desktop/mobile.

## INFORMACIÓN QUE NO PUDE CONFIRMAR DESDE EL CÓDIGO

1. ¿Qué secciones, papel y número de páginas deben ilustrarse en cada impresión?
2. ¿Quién recupera el acceso de un tutor y por qué canal autorizado?
3. ¿Qué política de conservación/recuperación de expedientes debe explicarse?
4. ¿Qué consentimiento se solicita antes de compartir documentos con ambos correos de tutores?
5. ¿Qué interpretación de medidas y gráficas debe incluir el manual, aprobada por el responsable clínico?
