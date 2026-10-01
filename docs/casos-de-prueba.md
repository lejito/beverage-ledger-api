# Documentación de Casos de Prueba – Beverage Ledger

## CP-001

- **Nombre del proyecto:** Beverage Ledger
- **Código caso de prueba:** CP-001
- **Escenario asociado:** EP-001
- **Requisito asociado:** RF-01 – Inicio de sesión con credenciales
- **Descripción:** Validar que un usuario registrado puede <br>iniciar sesión con credenciales válidas.
- **Objetivo:** Verificar que el sistema autentica correctamente al<br>usuario y permite el acceso al panel principal.
- **Criterio de éxito:** El usuario accede exitosamente al sistema <br>y visualiza el panel principal.
- **Nivel de prueba:** —
- **Riesgo asociado:** Alto
- **Responsable:** Juan sebastian
- **Caso de Prueba:** Inicio de sesión con credenciales válidas
- **Procedimiento Caso de Prueba:** Ejecutar el flujo de autenticación utilizando <br>un usuario válido registrado en el sistema.

| Paso | Acción | Datos | Caso de prueba | Procedimiento Caso de prueba | Resultado esperado | Resultado Obtenido | Estado | Evidencia | Version del Sistema Probada | Entorno probado | Fecha de ejecución |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | abrir la aplicacion | URL del sistma | CP-001 - COND -001 | Se muestra la pantalla de inicio de sesión | se visualiza bien la pantaña | formulario <br>visualizado | listo | imagenes | V.01 | microsoft <br>edge | 09/08/26 |
| 2 | Ingresar correo electrónico | Admin@test.com | CP-001 | Escribir un correo registrado | El correo es aceptado | acepta correo | listo | imagenes | V.01 | CELULAR | 10/08/26 |
| 3 | Ingresar contraseña | Contraseña válida | CP-001 | Escribir la contraseña correspondiente | La contraseña es aceptada | acepta contraseña | listo |  |  |  |  |
| 4 | Presionar Iniciar sesión | Presionar el botón Iniciar sesión. | CP-001 | Hacer clic en el botón Iniciar sesión | El sistema autentica al usuario y muestra el panel principal | ingreso | listo |  |  |  |  |
| 5 | Ingresar correo electrónico | Admin@test.com | CP-001 - COND -002 | Escribir un correo registrado | El sistema acepta el correo | acepta el correo | listo |  |  |  |  |
| 6 | Ingresar contraseña incorrecta | abc123 | CP-001 | Escribir una contraseña incorrecta. | La contraseña es procesada | contraseña incorrecta | listo |  |  |  |  |
| 7 | Iniciar sesión | Presionar el botón Iniciar sesión. | CP-001 | Presionar el botón Iniciar sesión | El sistema muestra un mensaje de error y no permite el acceso | no ingresa | listo |  |  |  |  |
| 8 | Ingresar correo inexistente | noexiste@ | CP-001 - COND-003 | Escribir un correo que no esté registrado. | usuario procesado no existe | no ingresa a el sistema | listo |  |  |  |  |
| 9 | Ingresar contraseña | SecurePass123! | CP-001 | Escribir contraseña | contraseña procesada | procesa la contrañea | listo |  |  |  |  |
| 10 | Iniciar sesión | Presionar el botón Iniciar sesión. | CP-001 | Presionar el botón Iniciar sesión. | ingresar el usuario | procesa el usuario | listo |  |  |  |  |
| 11 | Dejar correo vacío | No ingresar ningún correo. | CP-001- COND-004 | El campo permanece vacío. | contraseña procesada | introducir contraseña | listo |  |  |  |  |
| 12 | Ingresar contraseña | Escribir una contraseña válida. | CP-001 | La contraseña es aceptada. | El sistema solicita ingresar el correo y no permite continuar. | no continua | listo |  |  |  |  |
| 13 | Iniciar sesión | Presionar el botón Iniciar sesión. | CP-001 | Presionar el botón Iniciar sesió | El sistema ingresa | intenta ingresar pero no ingresa | listo |  |  |  |  |
| 14 | Ingresar correo | Admin@test.com | CP-001 - COND-005 | Escribir un correo registrado. | procesa correo | correo con buen procesamiento | listo |  |  |  |  |
| 15 | no se ingreso nada se deja celda vacia | no ingrese  ninguna clave | CP-001 | No ingresar contraseña | indicar ingresar contreña | llenar espacio de contraseña | listo |  |  |  |  |
| 16 | Iniciar sesión | Presionar el botón Iniciar sesión. | CP-001 | Presionar el botón Iniciar sesión. | inicia el proceso pide ingresar contraseña | realiza el proceso pero pide contraseña | listo |  |  |  |  |

## CP-002

- **Nombre del proyecto:** Beverage Ledger
- **Código caso de prueba:** CP-002
- **Escenario asociado:** EP-002
- **Requisito asociado:** RF-03
- **Descripción:** Verificar que un usuario invitado puede aceptar <br>un enlace de un solo uso, crear su contraseña y <br>activar correctamente su cuenta.
- **Objetivo:** Verificar que un usuario invitado puede aceptar un enlace de un solo uso,<br>definir su contraseña y activar correctamente su cuenta, Tambien que el usuario <br>dependiendo de su rol pueda ralizar las operacion solicitadas dentro de su rol
- **Criterio de éxito:** El usuario ingresa con URL enviado por el admnitrador, ingresa a la misma y crea <br>el usuario con el rol establecido, prueba que el entorno si sea de facil acceso para el usuario
- **Nivel de prueba:** —
- **Riesgo asociado:** Alto
- **Responsable:** Juan sebastian
- **Caso de Prueba:** Aceptar una invitacion
- **Procedimiento Caso de Prueba:** usuario invitado pueda recibir un enlace de un solo uso crear contraseña y pueda utilizar <br>la cuenta

| Paso | Acción | Datos | Caso de prueba | Procedimiento Caso de prueba | Resultado esperado | Resultado Obtenido | Estado | Evidencia | Version del Sistema Probada | Entorno probado | Fecha de ejecución |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Recibir invitación | URL de invitación enviada por el administrador | CP-002 | Verificar que el usuario invitado reciba correctamente el <br>enlace enviado por el administrador. | El usuario recibe la invitación con un enlace <br>válido para activar su cuenta. | usuario si recibe link | listo | imagenes | V.01 | microsoft <br>edge | 09/08/26 |
| 2 | Acceder al enlace | Enlace de un solo uso | CP-002 | Ingresar a la URL recibida y verificar que el sistema <br>permita acceder al proceso de activación. | El enlace me permitio acceder al formulario de activación de cuenta. | URL obtenida | listo | imagenes | V.01 | microsoft <br>edge | 10/08/26 |
| 3 | Validar uso único del enlace | Enlace utilizado previamente | CP-002 | Completar o iniciar la activación y posteriormente <br>intentar utilizar nuevamente el mismo enlace. | El sistema impide reutilizar el enlace y muestra un mensaje indicando <br>que ya fue utilizado o no es válido | se reutiliza el enlace, para crear varias | no aprobado |  |  | microsoft <br>edge |  |
| 4 | Crear contraseña | Contraseña que cumpla las políticas de seguridad | CP-002 | Ingresar una contraseña válida, confirmarla <br>y continuar con el proceso de activación. | El sistema acepta la contraseña y permite continuar con la activación. | si no muestra error | listo |  |  | microsoft <br>edge |  |
| 5 | Activar cuenta | Datos del usuario invitado | CP-002 | Finalizar el proceso de registro/activación del usuario. | La cuenta queda correctamente activa y el usuario puede ingresar al sistema. | si y puede ser utilizado | listo |  |  | microsoft <br>edge |  |
| 6 | Iniciar sesión | Usuario y contraseña creados | CP-002 | Ingresar al sistema utilizando las credenciales <br>configuradas durante la activación. | El usuario inicia sesión correctamente y accede al entorno correspondiente. | si problemas | listo |  |  | microsoft <br>edge |  |
| 7 | Validar rol asignado | Rol establecido por el administrador | CP-002 | Revisar que el usuario creado tenga el rol <br>definido originalmente en la invitación. | El usuario conserva el rol asignado por el administrador. | sin problemel usuario con rol activado | listo |  |  | microsoft <br>edge |  |
| 8 | Ejecutar operaciones permitidas | Funcionalidades correspondientes al rol | CP-002 | Realizar las operaciones que corresponden al rol asignado | El usuario puede ejecutar correctamente las operaciones autorizadas para su rol. | sin problema se puede usar, realiza <br>dependecias de roles | listo |  |  | microsoft <br>edge |  |
| 9 | Intentar operación no autorizada | Funcionalidad fuera del alcance del rol | CP-002 | Intentar acceder o ejecutar una operación que no corresponda<br> al rol asignado. | El sistema restringe el acceso o ejecución y muestra el <br>mensaje correspondiente de permisos insuficientes. | si indica accion no correspondiente | listo |  |  | microsoft <br>edge |  |
| 10 | Validar facilidad de uso | Flujo completo de activación | CP-002 | Realizar el proceso completo desde la recepción de la <br>invitación hasta el ingreso y ejecución de operaciones | El proceso es claro, intuitivo y permite al usuario completar la activación y <br>acceder a sus funcionalidades sin inconvenientes. | no se torno complicado, los colores oscuros <br>y las letras no se permeabilizan bien | no aprobado |  |  | microsoft <br>edge |  |
| 11 | Validar acceso posterior | Usuario activado | CP-002 | Cerrar sesión e iniciar nuevamente con las credenciales <br>creadas. | El usuario puede ingresar nuevamente sin necesidad de utilizar el enlace <br>de invitación | si puede ingresar de nuevo | no aprobado |  |  | microsoft <br>edge |  |

## CP-003

- **Nombre del proyecto:** Beverage Ledger
- **Código caso de prueba:** CP-003
- **Escenario asociado:** EP-003
- **Requisito asociado:** RF-29
- **Descripción:** Verificar que un administrador puede generar una invitación para un nuevo usuario <br>y que esta queda registrada como pendiente.
- **Objetivo:** Verificar que el administrador pueda generar correctamente una invitación para un nuevo usuario, que <br>el sistema registre la invitación con estado Pendiente y que el usuario invitado pueda acceder al enlace <br>enviado para crear su contraseña y activar su cuenta.
- **Criterio de éxito:** El sistema genera correctamente la invitación, la registra con estado Pendiente, envía el enlace (URL) <br>de invitación al correo del usuario y permite que el usuario acceda al enlace para crear su contraseña y <br>activar su cuenta exitosamente.
- **Nivel de prueba:** —
- **Riesgo asociado:** Verificar que un administrador puede generar una invitación para un nuevo usuario <br>y que esta queda registrada como pendiente.
- **Responsable:** Juan sebastian
- **Caso de Prueba:** gestion de usuario e invitacion
- **Procedimiento Caso de Prueba:** el administrador puede genera enlace y asignar roles de usuarios

| Paso | Acción | Datos | Caso de prueba | Procedimiento Caso de prueba | Resultado esperado | Resultado Obtenido | Estado | Evidencia | Version del Sistema Probada | Entorno probado | Fecha de ejecución |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ingresar como administrador | Usuario administrador y contraseña | CP-003 | El administrador ingresa al sistema con sus credenciales y <br>accede al módulo donde se gestionan los usuarios. | El administrador ingresa correctamente al sistema y puede acceder a la opción<br>para invitar nuevos usuarios | admi ingresa normal a el sistema con clave | listo | imagenes | V.01 | microsoft <br>edge | 09/08/26 |
| 2 | Crear invitación | Nombre, correo electrónico y rol del nuevo usuario | CP-003 | El administrador selecciona la opción para invitar un nuevo<br>usuario, ingresa los datos solicitados, selecciona el rol <br>correspondiente y genera la invitación. | El sistema genera correctamente la invitación para el nuevo usuario y muestra <br>una confirmación de que fue creada. | si problema se crea invitacion la cual es <br>recidbida por usuario | listo | imagenes | V.01 | microsoft <br>edge | 10/08/26 |
| 3 | Validar estado de la invitación | Invitación recién creada | CP-003 | El administrador consulta el listado o módulo de invitaciones<br>después de generar la invitación. | La invitación aparece registrada correctamente con estado Pendiente | se observa pendiente el usaurio acepte | listo |  |  | microsoft <br>edge |  |
| 4 | Validar datos de la invitación | Correo electrónico y rol asignado | CP-003 | El administrador revisa los datos de la invitación creada y <br>confirma que correspondan al usuario invitado y al rol<br>seleccionado | El sistema muestra correctamente el correo del usuario y el rol asignado en la invitación. | al ingreso el usuario tiene permitido, ingresar con<br>el rol asignado por el  admnistador | listo |  |  | microsoft <br>edge |  |
| 5 | Enviar invitación | Correo electrónico del usuario invitado | CP-003 | El sistema realiza el envío de la invitación al correo registrado <br>del nuevo usuario. | El usuario recibe en su correo el mensaje de invitación con la URL correspondiente<br> para acceder al sistema. | si problemas el usuario recibe la URL | listo |  |  | microsoft <br>edge |  |
| 6 | Acceder al enlace | URL enviada al correo | CP-003 | El usuario invitado abre el correo recibido y selecciona la URL <br>de invitación. | El enlace abre correctamente y dirige al usuario al proceso para crear su contraseña <br>y activar su cuenta | sin problemas | listo |  |  | microsoft <br>edge |  |
| 7 | Crear contraseña | Contraseña válida y confirmación | CP-003 | El usuario ingresa y confirma una contraseña que cumpla <br>con las condiciones establecidas por el sistema. | El sistema permite crear la contraseña y continuar con el proceso de activación. | sin problemas, contraseña se introduce correcta | listo |  |  | microsoft <br>edge |  |
| 8 | Activar cuenta | Datos del usuario invitado | CP-003 | El usuario completa los pasos solicitados después de crear la<br> contraseña y confirma la activación de su cuenta. | La cuenta del usuario queda activada correctamente y el sistema muestra la confirmación<br> correspondiente. | se obeserva que queda bien aplicada | listo |  |  | microsoft <br>edge |  |
| 9 | Validar estado de la invitación | Usuario activado | CP-003 | El administrador consulta nuevamente el registro de invitaciones <br>después de que el usuario haya activado su cuenta. | El estado de la invitación cambia de Pendiente al estado correspondiente a una invitación <br>utilizada/aceptada o cuenta activada, según lo definido por el sistema | se observa el estado de laa cuenta de manera <br>de manera visible | listo |  |  | microsoft <br>edge |  |
| 10 | Iniciar sesión como usuario invitado | Correo y contraseña creados | CP-003 | El usuario invitado ingresa al sistema utilizando las credenciales<br>que configuró durante la activación. | El usuario puede ingresar correctamente al sistema y acceder al entorno correspondiente <br>a su rol. | si puede ingresar y tiene funcionalidades del rol | listo |  |  | microsoft <br>edge |  |
| 11 | Validar rol y permisos | Rol asignado por el administrador | CP-003 | El usuario ingresa al sistema y se validan las opciones y <br>funcionalidades disponibles según el rol asignado durante <br>la invitación. | El usuario conserva el rol definido por el administrador y puede acceder únicamente a las <br>funcionalidades permitidas para dicho rol. | si solo las permitidas ninguna otra | listo |  |  | microsoft <br>edge |  |
| 12 | Validar facilidad de uso | Flujo completo de invitación y activación | CP-003 | Se realiza el proceso completo desde la generación de la <br> invitación hasta la activación e ingreso del usuario, verificando<br> la facilidad de navegación. | El proceso es claro, sencillo y permite al administrador generar la invitación y al usuario <br>invitado activar su cuenta sin inconvenientes | el proceso es sencillo y facil de hacer. | listo |  |  | microsoft <br>edge |  |

## CP-004

- **Nombre del proyecto:** Beverage Ledger
- **Código caso de prueba:** CP-004
- **Escenario asociado:** EP-004
- **Requisito asociado:** RF-30
- **Descripción:** Verificar que el administrador puede consultar el historial de auditoría<br>aplicando filtros por usuario y rango de fechas.
- **Objetivo:** Verificar que el administrador pueda consultar correctamente el historial de <br>auditoría utilizando filtros por usuario y rango de fechas, y que el sistema<br>muestre únicamente los registros que cumplen con los criterios seleccionados.
- **Criterio de éxito:** El sistema permite aplicar filtros por usuario y rango de fechas, muestra los registros de<br>correspondientes a los filtros seleccionados y presenta la información de manera correcta, <br>completa y ordenada cronológicamente
- **Nivel de prueba:** —
- **Riesgo asociado:** Alto, debido a que una falla en la consulta o filtrado del historial de auditoría afectaría la trazabilidad <br>de las acciones realizadas por los usuarios y dificultaría los procesos de control, seguimiento y <br>auditoría
- **Responsable:** Juan sebastian
- **Caso de Prueba:** gestion de usuario e invitacion
- **Procedimiento Caso de Prueba:** —

| Paso | Acción | Datos | Caso de prueba | Procedimiento Caso de prueba | Resultado esperado | Resultado Obtenido | Estado | Evidencia | Version del Sistema Probada | Entorno probado | Fecha de ejecución |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ingresar como administrador | Usuario administrador y contraseña | CP-004 | El administrador ingresa al sistema con sus credenciales y <br>accede al módulo de historial de auditoría | El administrador ingresa correctamente y puede acceder al historial de auditoría. | si puede ingresar a la auditoria | listo | imagenes | V.01 | microsoft <br>edge | 09/08/26 |
| 2 | Consultar historial de auditoría | Registros de acciones realizadas por los usuarios | CP-004 | El administrador ingresa al módulo de auditoría y consulta los <br>registros disponibles sin aplicar filtros. | El sistema muestra correctamente el historial de auditoría con los registros disponibles. | si muestra la cantidad de registros realizados | listo | imagenes | V.01 | microsoft <br>edge | 10/08/26 |
| 3 | Filtrar por usuario | Usuario seleccionado | CP-004 | El administrador selecciona un usuario específico en el filtro y <br>realiza la consulta. | El sistema muestra únicamente los registros de auditoría asociados al usuario seleccionado. | si solo enseña lo seleccionado | listo |  |  | microsoft <br>edge | 11/08/26 |
| 4 | Filtrar por rango de fechas | Fecha inicial y fecha final | CP-004 | El administrador selecciona una fecha inicial y una fecha final <br>y ejecuta la búsqueda. | El sistema muestra únicamente los registros generados dentro del rango de fechas seleccionado. | no muestra de manera clara lo solicitado | no aprobado |  |  | microsoft <br>edge | 12/08/26 |
| 5 | Aplicar filtros combinados | Usuario, fecha inicial y fecha final | CP-004 | El administrador selecciona un usuario y establece un rango <br>de fechas para realizar la consulta de auditoría. | El sistema muestra únicamente los registros que corresponden al usuario seleccionado y que se <br>encuentran dentro del rango de fechas indicado. | si muestra la informacion | listo |  |  | microsoft <br>edge | 13/08/26 |
| 6 | Validar información de los registros | Usuario, fecha, hora, acción y demás datos disponibles | CP-004 | El administrador revisa los registros obtenidos después de aplicar <br>los filtros. | Los registros muestran la información de auditoría de forma completa, clara y correcta, <br>de acuerdo con los datos registrados por el sistema. | si la informacion aparece registrada | listo |  |  | microsoft <br>edge | 14/08/26 |
| 7 | Validar orden cronológico | Registros filtrados | ÇP-004 | El administrador revisa el orden en que se presentan los registros <br>de auditoría | Los registros se muestran ordenados cronológicamente, de acuerdo con la fecha y hora de las <br>acciones realizadas. | si registros aparecen | listo |  |  | microsoft <br>edge | 15/08/26 |
| 8 | Validar resultados sin coincidencias | Usuario y/o rango de fechas sin registros | CP-004 | El administrador aplica filtros correspondientes a un usuario o <br>rango de fechas que no tengan registros de auditoría. | El sistema informa claramente que no existen registros que coincidan con los criterios seleccionados<br>sin mostrar información incorrecta. | si lo enseña sin problemas | listo |  |  | microsoft <br>edge | 16/08/26 |
| 9 | Limpiar filtros | Filtros previamente aplicados | CP-004 | El administrador utiliza la opción para limpiar los filtros aplicados<br> y realiza nuevamente la consulta. | El sistema elimina los criterios seleccionados y permite consultar nuevamente el historial completo <br>o sin los filtros anteriores. | si permite mirar sin filtros | listo |  |  | microsoft <br>edge | 17/08/26 |
| 10 | Validar acceso según rol | Usuario administrador y contraseña | CP-004 | El administrador accede al módulo de auditoría y verifica que <br>pueda consultar la información correspondiente | El administrador puede consultar el historial de auditoría de acuerdo con los permisos definidos para su rol. | si el administrador puede mirar | listo |  |  | microsoft <br>edge | 18/08/26 |

> Nota (fila 199 de la hoja): Entorno probado: Microsoft Edge · Fecha de ejecución: 19/08/26

## CP-005

- **Nombre del proyecto:** Beverage Ledger
- **Código caso de prueba:** CP-005
- **Escenario asociado:** EP-005
- **Requisito asociado:** RF-09
- **Descripción:** Verificar que el sistema impide modificar el valor de “unidades por caja”<br>de un producto existente, cumpliendo la regla de negocio RN-09.
- **Objetivo:** Verificar que el sistema no permita modificar el campo unidades por caja de un producto ya registrado, <br>garantizando el cumplimiento de la regla de negocio RN-09 y preservando la integridad del inventario
- **Criterio de éxito:** El sistema impide modificar el valor de unidades por caja de un producto existente, bloqueando <br>la edición del campo o rechazando el cambio con un mensaje de validación, sin alterar la información <br>registrada del producto.
- **Nivel de prueba:** —
- **Riesgo asociado:** Alto, debido a que una modificación indebida del valor de unidades por caja afectaría los cálculos de <br>existencias, conversiones entre cajas y unidades, movimientos de inventario y reportes del sistema.
- **Responsable:** Juan sebastian
- **Caso de Prueba:** —
- **Procedimiento Caso de Prueba:** —

| Paso | Acción | Datos | Caso de prueba | Procedimiento Caso de prueba | Resultado esperado | Resultado Obtenido | Estado | Evidencia | Version del Sistema Probada | Entorno probado | Fecha de ejecución |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ingresar al sistema | Usuario administrador o usuario con permisos para <br>gestionar productos | CP-005 | El usuario ingresa al sistema con sus credenciales y accede al <br>módulo donde se encuentran registrados los productos. | El usuario puede ingresar correctamente al módulo de productos y consultar la información registrada. |  | listo | imagenes | V.01 | microsoft <br>edge | 09/08/26 |
| 2 | Consultar producto existente | Producto previamente registrado | CP-005 | El usuario busca y selecciona un producto que ya se encuentre <br>registrado en el sistema. | El sistema muestra correctamente la información del producto seleccionado, incluyendo el campo unidades por caja. |  | listo | imagenes | V.01 | CELULAR | 10/08/26 |
| 3 | Consultar valor de unidades por caja | Valor actual de unidades por caja | CP-005 | El usuario revisa el valor actual registrado en el campo unidades<br> por caja antes de intentar realizar alguna modificación. | El sistema muestra el valor de unidades por caja que fue registrado originalmente para el producto. |  |  |  |  |  |  |
| 4 | Intentar modificar unidades por caja | Nuevo valor diferente al registrado | CP-005 | El usuario intenta modificar el valor de unidades por caja de un<br> producto existente e ingresa un valor diferente al registrado | El sistema no permite modificar el valor. El campo debe permanecer bloqueado o el sistema debe rechazar<br> el cambio mediante una validación. |  |  |  |  |  |  |
| 5 | Guardar cambios | Nuevo valor no permitido | CP-005 | El usuario intenta guardar los cambios realizados después de <br>modificar el campo unidades por caja. | El sistema impide guardar la modificación y mantiene el valor original registrado para el producto. |  |  |  |  |  |  |
| 6 | Consultar nuevamente el producto | Producto previamente registrado | CP-005 | El usuario sale del producto, vuelve a consultarlo y revisa <br>nuevamente el campo unidades por caja. | El valor de unidades por caja permanece igual al registrado inicialmente y no presenta modificaciones. |  |  |  |  |  |  |
| 7 | Validar integridad del inventario | Producto y existencias asociadas | CP-005 | El usuario revisa las existencias y demás información <br>relacionada con el producto después del intento de modificación. | Las existencias, conversiones y demás datos relacionados con el producto permanecen sin alteraciones. |  |  |  |  |  |  |
| 8 | Validar regla de negocio RN-09 | Producto existente y valor de unidades por caja | CP-005 | Se verifica que el sistema mantenga bloqueada o rechace cualquier <br>modificación del campo unidades por caja para productos existentes. | El sistema cumple con la RN-09, impidiendo modificar el valor de unidades por caja de un producto ya registrado. |  |  |  |  |  |  |

## CP-011

- **Nombre del proyecto:** Beverage Ledger
- **Código caso de prueba:** CP-011
- **Escenario asociado:** EP-011
- **Requisito asociado:** RF-06
- **Descripción:** Verificar que el sistema permita al usuario cambiar su contraseña desde el perfil personal, validando la <br>contraseña actual y la confirmación de la nueva contraseña, garantizando la actualización segura de las<br> credenciales.
- **Objetivo:** Verificar que el usuario pueda modificar correctamente su contraseña desde la sección de perfil y que, <br>después de realizar el cambio, el sistema cierre todas las sesiones activas obligando al usuario a ingresar <br>nuevamente con la nueva contraseña.
- **Criterio de éxito:** El sistema permite realizar el cambio cuando la contraseña actual es correcta y la nueva contraseña <br>coincide con su confirmación. Después de guardar, todas las sesiones activas son cerradas y el usuario <br>debe autenticarse nuevamente utilizando la nueva contraseña.
- **Nivel de prueba:** Sistema
- **Riesgo asociado:** Alto, debido a que una gestión incorrecta del cambio de contraseña puede comprometer la seguridad de <br>las cuentas, permitir accesos no autorizados o mantener sesiones activas con credenciales antiguas.
- **Responsable:** Juan sebastian
- **Caso de Prueba:** Validar el cambio de contraseña de un usuario registrado desde el perfil personal.
- **Procedimiento Caso de Prueba:** Precondiciones:<br>1. El usuario debe estar registrado en el sistema.<br>2. El usuario debe tener una sesión activa.<br>3. El usuario debe conocer su contraseña actual.

| Paso | Acción | Datos | Caso de prueba | Procedimiento Caso de prueba | Resultado esperado | Resultado Obtenido | Estado | Evidencia | Version del Sistema Probada | Entorno probado | Fecha de ejecución |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ingresar al sistema con un usuario válido. | Usuario registrado y contraseña actual válida. | CP-011 | Acceder al sistema con credenciales correctas para iniciar la prueba 0<br>de cambio de contraseña. | El sistema permite el ingreso correctamente y muestra la interfaz principal del usuario. | El usuario ingresó correctamente al sistema utilizando <br>sus credenciales válidas y se permitió el acceso a la plataforma. | listo | imagenes | V.01 | microsoft <br>edge | 09/08/26 |
| 2 | Acceder al módulo Perfil de usuario | Usuario autenticado dentro del sistema. | CP-011 | Ingresar al perfil del usuario y seleccionar la opción para cambiar contraseña. | El sistema muestra el formulario de cambio de contraseña. | El usuario accedió al módulo de perfil y visualizó correctamente la <br>opción para realizar el cambio de contraseña. | listo | imagenes | V.01 | CELULAR | 10/08/26 |
| 3 | Ingresar la contraseña actual. | Contraseña actual registrada del usuario. | CP-011 | Digitar la contraseña actual en el campo correspondiente para validar la i<br>dentidad del usuario. | El sistema acepta la contraseña actual y permite continuar con el cambio. | El sistema validó correctamente la contraseña actual ingresada por el <br>usuario y permitió continuar con el proceso. | listo |  |  |  |  |
| 4 | Registrar la nueva contraseña. | Nueva contraseña válida según las reglas del sistema. | CP-011 | Ingresar una nueva contraseña diferente a la anterior cumpliendo las <br>condiciones de seguridad. | El sistema permite ingresar la nueva contraseña. | La nueva contraseña fue registrada correctamente en el formulario de<br> cambio de contraseña. | listo |  |  |  |  |
| 5 | Confirmar la nueva contraseña. | Repetir exactamente la nueva contraseña. | CP-011 | Ingresar nuevamente la nueva contraseña en el campo de confirmación | El sistema valida que ambas contraseñas coincidan. | El sistema verificó que la nueva contraseña y su confirmación coincidieran, <br>permitiendo continuar con la actualización. | listo |  |  |  |  |
| 6 | Guardar el cambio de contraseña. | Datos completos y válidos. | CP-011 | Seleccionar la opción guardar para actualizar la contraseña del usuario. | El sistema actualiza la contraseña correctamente y muestra mensaje de confirmación. | El sistema realizó la actualización de la contraseña correctamente y mostró <br>un mensaje confirmando el cambio exitoso. | listo |  |  |  |  |
| 7 | Verificar cierre de sesiones activas. | Usuario con sesiones abiertas previamente. | CP-011 | Intentar acceder desde una sesión anterior después del cambio de contraseña. | El sistema cierra las sesiones activas y solicita autenticación nuevamente. | Se verificó que las sesiones activas del usuario fueron cerradas después <br>del cambio de contraseña, solicitando nuevamente autenticación. | listo |  |  |  |  |
| 8 | Ingresar nuevamente con la nueva contraseña. | Usuario registrado y nueva contraseña creada. | CP-011 | Iniciar sesión nuevamente utilizando la nueva contraseña configurada | El sistema permite el acceso únicamente con la nueva contraseña y rechaza la contraseña anterior. | El usuario logró ingresar nuevamente al sistema utilizando la nueva <br>contraseña. La contraseña anterior fue rechazada correctamente. | listo |  |  |  |  |

