# Plan de pruebas y CI/CD con Jenkins

Plan para cumplir la rúbrica de la asignatura de pruebas de software sobre los dos proyectos de Beverage Ledger:

| Proyecto | Repositorio | Stack |
|---|---|---|
| API | `beverage-ledger-api` | NestJS 11, Prisma 7, PostgreSQL |
| Front | `beverage-ledger` | Next.js 15, React 19, TypeScript |

Los dos repositorios son independientes, así que cada uno tiene su propio `Jenkinsfile` y su propio pipeline.

El plan sigue el material de la asignatura:

- **Clase 15** (pruebas unitarias): patrón AAA, dobles de prueba y Fluent Assertions. Ver sección 7.
- **Clase 13** (calidad de pruebas): pruebas de regresión y métricas. Ver secciones 8 y 15.

---

## 1. Qué pide la rúbrica

| Criterio | Puntos | Qué hay que demostrar para el 100 % |
|---|---:|---|
| Integración continua (Jenkins, Docker, SonarQube) | 30 | Un pipeline en Jenkins que construye, ejecuta las pruebas de las seis funcionalidades, analiza con SonarQube y ejecuta la aplicación con Docker |
| Pruebas con Fluent Assertions | 20 | Pruebas de las seis funcionalidades con aserciones claras que verifican resultados |
| Pruebas de regresión | 20 | Una suite de regresión de las seis funcionalidades que demuestre que detecta un cambio que rompe algo |
| Presentación y sustentación | 30 | Explicar funcionalidades, pipeline, pruebas y resultados |

Etapas que debe tener cada pipeline:

1. Compilación y build del proyecto.
2. Pruebas unitarias.
3. Pruebas de regresión.
4. Análisis estático con SonarQube.
5. Creación y publicación de la imagen Docker.
6. Despliegue y arranque de la aplicación.

---

## 2. Dónde correr Jenkins

**No hace falta montar un servidor.** Para la actividad lo más práctico es correr Jenkins y SonarQube en el propio computador, dentro de Docker Desktop. La rúbrica pide *demostrar* un pipeline funcional, no que viva en la nube.

| Opción | Ventajas | Inconvenientes |
|---|---|---|
| **Local con Docker Desktop** (recomendada) | Gratis, control total, sin administrar un servidor | GitHub no puede enviar webhooks a `localhost` |
| VM gratuita (Oracle Cloud Always Free, 4 núcleos ARM / 24 GB) | Webhooks reales, accesible desde fuera | Horas de administración: red, seguridad, certificados |
| VM pequeña (AWS t2.micro, 1 GB) | — | No alcanza para Jenkins + SonarQube + build de Next + Playwright |

Sin webhooks basta con lanzar el build con **Build Now** o configurar **Poll SCM** (por ejemplo `H/2 * * * *`). Si se quiere que el push dispare el build, se puede exponer Jenkins con ngrok.

**Requisito de máquina:** Docker Desktop con al menos 8 GB de memoria asignada. SonarQube solo consume unos 2 GB.

---

## 3. Decisiones tomadas

### 3.1 Fluent Assertions: Chai

La Clase 15 presenta Fluent Assertions con ejemplos en C# (`value.Should().Be(...)`), pero la idea que enseña es un **estilo**: aserciones que se leen como una frase, declarativas y con mensajes de error descriptivos. La propia clase da como ejemplo Hamcrest en Python, que no es la librería de C#.

El material de la clase es poco preciso en lo técnico, así que el criterio es el estilo y no el nombre de la librería. En TypeScript se usa **Chai**, que viene dentro de Vitest y que la tabla de librerías de la clase (diapositiva 18) cita para JavaScript. No hay que instalar nada:

```ts
expect(user).to.be.an('object').that.includes({ role: 'OPERATOR', status: 'ACTIVE' });
expect(page.data).to.have.lengthOf(2).and.to.satisfy((rows) => rows.every((r) => r.user.id === actorId));
expect(error).to.be.instanceOf(UnauthorizedException);
```

La sección 7.2 tiene la equivalencia entre los métodos que enseña la clase y los de Chai. Esa tabla es también el argumento para la sustentación: cada `Should().X()` de la diapositiva 9 tiene su forma en Chai.

### 3.2 Análisis estático: SonarQube local

Se usa **SonarQube Community** en Docker, junto a Jenkins (sección 6). Los repositorios originales publican en SonarCloud con GitHub Actions. En los forks (3.4) hay que ajustar dos cosas:

- **Workflow `.github/workflows/sonar.yml`:** GitHub deja desactivadas las Actions en un fork hasta que alguien las activa. Hay que dejarlas así, o borrar el workflow del fork: sin el secreto `SONAR_TOKEN` del proyecto original, fallaría en cada push.
- **`sonar-project.properties`:** quitar `sonar.organization` (solo existe en SonarCloud) y cambiar `sonar.projectKey` por la clave del proyecto en el SonarQube local. `sonar.coverage.exclusions` se queda igual.

### 3.3 Despliegue: cuentas propias

No somos dueños del proyecto, así que todo se despliega en **cuentas nuevas del equipo**. El despliegue actual del proyecto original no se toca.

| Pieza | Servicio | Qué crear |
|---|---|---|
| Imágenes | Docker Hub | Cuenta y *access token* |
| API | Render | Un *Web Service* de tipo **Deploy an existing image**, apuntando a la imagen de Docker Hub. **No** crearlo desde el Blueprint (`render.yaml`): ese construye desde git y desplegaría con cada push, en paralelo a Jenkins |
| Front | Vercel | Un proyecto creado con la CLI (`vercel link`) **sin conectar el repositorio de GitHub**. Si se conecta, Vercel despliega solo con cada push y Jenkins deja de ser quien decide cuándo se despliega |
| Base de datos | Supabase (recomendado) o Render Postgres | Un proyecto nuevo, con `DATABASE_URL` (puerto 6543) y `DIRECT_URL` (5432) según `CLAUDE.md` §4. Verificar los límites del plan gratuito: Supabase pausa los proyectos inactivos, y Render ha limitado en el tiempo sus bases gratuitas |

Configuración inicial de la base nueva, una sola vez, desde el computador local:

```bash
DIRECT_URL=<url directa> DATABASE_URL=<url pooler> pnpm exec prisma migrate deploy
DIRECT_URL=<url directa> DATABASE_URL=<url pooler> SEED_ADMIN_PASSWORD=<contraseña> pnpm db:seed
```

Después, cada despliegue de la API aplica sus migraciones al arrancar (10.1).

Variables de la API en Render: las de `.env.example`, con `FRONTEND_URL` y `CORS_ORIGINS` apuntando a la URL del proyecto nuevo de Vercel, y `NODE_ENV=production`. Las de Google se dejan vacías: la API arranca igual y las rutas de Google responden 501 (`CLAUDE.md` §2). En Vercel, `NEXT_PUBLIC_API_URL` apunta a la URL del servicio nuevo de Render.

### 3.4 Repositorios: forks

Los dos repositorios se **forkean** a una cuenta del equipo. Todo el trabajo (pruebas, `Dockerfile`, `Jenkinsfile`, colección de Postman) se sube al fork y nunca al repositorio original. Jenkins clona el fork.

Los clones locales apuntan hoy al repositorio original (`origin`). Después de crear los forks, en cada clon:

```bash
git remote rename origin upstream
git remote add origin https://github.com/sepita1234/beverage-ledger-api.git
git push -u origin main
```

`upstream` queda para traer cambios del original si hiciera falta (`git fetch upstream`), y `origin` es el fork. Un fork de un repositorio público es público, así que Jenkins lo clona sin credenciales. Si se hace privado, hace falta la credencial `github` de 6.3.

---

## 4. Arquitectura

```
Computador local (Docker Desktop)
│
├── ci/   ← carpeta aparte, fuera de los dos repositorios
│   └── docker-compose: jenkins + sonarqube
│         jenkins monta /var/run/docker.sock: construye imágenes y levanta stacks
│
├── Pipeline API   (Jenkinsfile en beverage-ledger-api)
│     install → lint/typecheck → build → unitarias → imagen Docker
│     → [stack efímero: postgres + api] → regresión
│     → SonarQube → publicar imagen → desplegar + smoke test
│
└── Pipeline Front (Jenkinsfile en beverage-ledger)
      install → lint/typecheck → build → unitarias → imagen Docker
      → [stack efímero: postgres + api (imagen publicada) + web] → Playwright
      → SonarQube → publicar imagen → desplegar + smoke test
```

El pipeline del front levanta **la imagen de la API que publicó el pipeline de la API**, con un tag fijo. Esa es la integración real entre los dos proyectos.

---

## 5. Fase 0: decisiones

1. **Las seis funcionalidades** ya están elegidas y documentadas como casos de prueba manuales en [casos-de-prueba.md](casos-de-prueba.md):

   | Caso | Requisito | Funcionalidad | Unidad bajo prueba (API) | Pruebas existentes (API) | Pruebas existentes (front) |
   |---|---|---|---|---|---|
   | CP-001 | RF-01 | Inicio de sesión con credenciales | `CredentialsService.validateCredentials` | `test/rf-01-back-validate-credentials.test.ts` | `tests/rf-01-front-*.test.ts` (4 archivos) |
   | CP-002 | RF-03 | Aceptar una invitación | `InvitationsService.accept` | `test/rf-03-back-accept.test.ts` | `tests/rf-03-front-accept.test.ts`, `tests/rf-03-front-accept-invite-form.test.ts` |
   | CP-003 | RF-29 | Gestión de usuarios e invitaciones | `UsersService.update` y `InvitationsAdminService.create` | `test/rf-29-back-update.test.ts` | `tests/rf-29-front-update.test.ts`, `tests/rf-29-front-change-status.test.ts` |
   | CP-004 | RF-30 | Historial de auditoría con filtros | `AuditRepository.findPage` | `test/rf-30-back-find-page.test.ts` | `tests/rf-30-front-choose-entity.test.ts`, `tests/rf-30-front-find-page.test.ts` |
   | CP-005 | RF-09 | Editar producto sin cambiar unidades por caja (RN-09) | `ProductsAdminService.update` y `UpdateProductDto` | `test/rf-09-back-update.test.ts` | `tests/rf-09-front-update.test.ts`, `tests/rf-09-front-submit.test.ts` |
   | CP-011 | RF-06 | Cambiar la contraseña desde el perfil | `ProfileService.changePassword` | `test/rf-06-back-change-password.test.ts` | `tests/rf-06-front-submit.test.ts` |

   Los casos manuales son la base de todo lo demás: cada paso de su tabla se convierte en una prueba automatizada de regresión (sección 8), y las pruebas unitarias cubren la lógica que hay detrás de esos pasos (sección 7). Las brechas que hay hoy entre los casos y las pruebas están en 5.1.

2. **Crear una cuenta en Docker Hub** (los repositorios públicos son gratis) y generar un *access token*.
3. **Forkear los dos repositorios** y reapuntar los clones locales (3.4).
4. **Crear las cuentas de despliegue**: Render, Vercel y Supabase (3.3).

### 5.1 Brechas entre los casos y las pruebas actuales

Revisando las pruebas existentes contra los seis casos aparecen problemas que conviene resolver **antes** de montar el pipeline, porque algunos lo harían fallar y otros restan puntos en la rúbrica ("algunas aserciones no verifican adecuadamente los resultados": 12 de 20).

#### API

| Caso | Brecha | Qué hacer |
|---|---|---|
| CP-003 | `rf-29-back-update` prueba `UsersService.update` (cambio de rol y estado), pero el caso manual prueba **crear una invitación** y verla como pendiente. Nada prueba `InvitationsAdminService.create` | Añadir `test/rf-29-back-create-invitation.test.ts` con los caminos de `create`: email que ya es miembro (409), invitación creada con estado pendiente y rol pedido, y registro de auditoría. Añadir `invitations-admin.service.ts` a `coverage.include` y quitarlo de `sonar.coverage.exclusions` |
| CP-005 | `rf-09-back-update` prueba nombre y desactivación, pero **ninguna prueba cubre RN-09**, que es el objetivo del caso. La regla la impone que `UpdateProductDto` no declara `caseSize` y el `ValidationPipe` global rechaza lo no declarado | Añadir una prueba que pase `{ caseSize: 24 }` por un `ValidationPipe` con las mismas opciones que `main.ts` (`whitelist`, `forbidNonWhitelisted`, `transform`) y afirme que lanza `BadRequestException`. Si alguien añade `caseSize` al DTO, la prueba falla |
| CP-004 | El paso 4 del caso manual (filtrar por rango de fechas) quedó **no aprobado**. `rf-30-back-find-page` tiene caminos para `from`/`to`, pero no para el límite del día: un filtro `to = 2026-08-12` debe incluir los registros de todo ese día | Revisar si el fallo está en la API o en el front, y añadir el caso de borde a la prueba de la capa responsable |

#### Front

| Problema | Archivos | Por qué importa | Qué hacer |
|---|---|---|---|
| **Llaman a la API real** con `fetch` y credenciales de `.env` (`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`) | `rf-01-front-handle-submit`, `rf-03-front-accept-invite-form`, `rf-09-front-submit`, `rf-29-front-change-status` | No son pruebas unitarias: sin una API levantada, la etapa de pruebas unitarias del pipeline falla | Moverlas a la suite de regresión o borrarlas si ya tienen una versión con dobles |
| **Prueban el doble, no la aplicación**: reemplazan `fetch` por un doble y luego llaman a `fetch` directamente | `rf-01-front-validate-credentials`, `rf-03-front-accept` | La aserción verifica lo que el propio doble devuelve; ningún código del front se ejecuta | Reescribirlas para llamar a la función real (`features/invitations/api.ts`, el `signIn` de `features/auth`) con `fetch` sustituido |
| **Aserciones que no verifican nada** | p. ej. `expect(response.status).toBeDefined()` en `rf-03-front-accept-invite-form` | Pasan con cualquier respuesta, también con un error 500 | Afirmar el valor concreto esperado |
| **Archivos duplicados** con el mismo `describe` | Parejas de RF-03, RF-09, RF-29 y RF-30 | Parece que conviven una versión antigua (contra la API real) y una nueva (con dobles) | Quedarse con la versión con dobles y borrar la otra |

Las versiones que sí son buenas pruebas unitarias, porque sustituyen la red con dobles y ejecutan código real del front, son `rf-06-front-submit`, `rf-09-front-update`, `rf-29-front-update`, `rf-30-front-choose-entity`, `rf-01-front-describe-error` y `rf-01-front-forget-session`.

---

## 6. Fase 1: infraestructura local (Jenkins + SonarQube)

### 6.1 Carpeta `ci/`

Se crea fuera de los dos repositorios, porque la comparten ambos pipelines.

`ci/Dockerfile.jenkins`: Jenkins con Node 22, pnpm, Docker CLI con compose y las dependencias de sistema de Chromium para Playwright.

```dockerfile
FROM jenkins/jenkins:lts-jdk21
USER root
RUN apt-get update && apt-get install -y ca-certificates curl gnupg \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && echo "deb [signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
      > /etc/apt/sources.list.d/docker.list \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y nodejs docker-ce-cli docker-compose-plugin \
 && corepack enable \
 && npx -y playwright install-deps chromium \
 && rm -rf /var/lib/apt/lists/*
```

`ci/docker-compose.yml`:

```yaml
name: ci

services:
  jenkins:
    build:
      context: .
      dockerfile: Dockerfile.jenkins
    container_name: jenkins
    # Only acceptable on a local machine: root lets Jenkins use the Docker socket.
    user: root
    ports:
      - '8080:8080'
    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock

  sonarqube:
    image: sonarqube:community
    container_name: sonarqube
    ports:
      - '9000:9000'
    volumes:
      - sonar_data:/opt/sonarqube/data
      - sonar_extensions:/opt/sonarqube/extensions

volumes:
  jenkins_home:
  sonar_data:
  sonar_extensions:
```

Con `name: ci`, la red que crea compose se llama `ci_default`. Los pipelines la usan para llegar a `sonarqube`.

### 6.2 Arranque

1. En Windows, SonarQube (Elasticsearch) necesita este ajuste del kernel de WSL, que hay que repetir tras reiniciar Docker Desktop:
   ```bash
   wsl -d docker-desktop sysctl -w vm.max_map_count=262144
   ```
2. Levantar los servicios: `docker compose up -d --build` dentro de `ci/`.
3. Abrir Jenkins en `http://localhost:8080`. La contraseña inicial se lee con `docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword`.
4. Abrir SonarQube en `http://localhost:9000` (`admin` / `admin`, pide cambiarla).

### 6.3 Configuración de Jenkins

1. **Plugins:** Pipeline, Git, SonarQube Scanner, JUnit, HTML Publisher, Docker Pipeline, Credentials Binding.
2. **Credenciales** (*Manage Jenkins → Credentials*):

   | ID | Tipo | Contenido |
   |---|---|---|
   | `dockerhub` | Username with password | Usuario y access token de Docker Hub |
   | `sonar-token` | Secret text | Token generado en SonarQube |
   | `github` | Username with password | Solo si los repositorios son privados |
   | `render-deploy-hook` | Secret text | Opcional, sección 9.2 |
   | `vercel-token` | Secret text | Opcional, sección 9.2 |

3. **Servidor SonarQube** (*Manage Jenkins → System → SonarQube servers*): nombre `sonarqube`, URL `http://sonarqube:9000`, token `sonar-token`.
4. **Webhook de vuelta** en SonarQube (*Administration → Configuration → Webhooks*): `http://jenkins:8080/sonarqube-webhook/`. Sin él, `waitForQualityGate` se queda esperando hasta el timeout.
5. **Dos jobs** de tipo *Pipeline → Pipeline script from SCM*, uno por repositorio, que lean el `Jenkinsfile` de la raíz.

---

## 7. Fase 2: pruebas unitarias

Ya existen en los dos proyectos con **Vitest**:

- API: `test/rf-*.test.ts`. Instancian los services con `new` y repositorios simulados con `vi.fn()`, sin base de datos ni `@nestjs/testing`.
- Front: `tests/rf-*.test.ts(x)`, con `jsdom` y Testing Library, simulando el cliente de la API con `vi.mock`.

El ejercicio de la Clase 15 pide aplicar tres cosas: **patrón AAA, dobles de prueba y Fluent Assertions**. Los dobles ya están (`vi.fn()`, `vi.mock`). Falta lo siguiente.

### 7.1 Patrón AAA

Cada prueba se divide en las tres secciones de la clase, marcadas con comentario como en los ejemplos de las diapositivas 13 a 15:

- **Arrange**: construir el service con sus dobles y preparar los datos de entrada.
- **Act**: una sola llamada al método bajo prueba.
- **Assert**: comprobar el resultado con aserciones fluidas.

Las pruebas de la API ya marcan las tres secciones. Lo que falta es el estilo fluido en la aserción. Así está hoy `test/rf-03-back-accept.test.ts`, el camino que cubre el paso 3 de CP-002 (el enlace es de un solo uso):

```ts
it('Camino 3 - segunda aceptacion del mismo token lanza BadRequestException', async () => {
  // Arrange
  findRedeemableByHash.mockResolvedValue({ id: 'invitation-2', organizationId: 'organization-1', email: 'carrera@example.com', role: 'OPERATOR' });
  userExists.mockResolvedValue(false);
  hash.mockResolvedValue('password-hash');
  runInTransaction.mockImplementation(async (callback: any) => callback({}));
  markAccepted.mockResolvedValue(false);

  // Act
  const resultado = invitations.accept({ token: 'token-carrera', name: 'Usuario Carrera', password: 'Contraseña123!' });

  // Assert
  await expect(resultado).rejects.toThrow(BadRequestException);
});
```

Con aserciones fluidas, separando *Act* de *Assert* y verificando también que la invitación se intentó marcar como aceptada:

```ts
  // Act
  const error = await invitations
    .accept({ token: 'token-carrera', name: 'Usuario Carrera', password: 'Contraseña123!' })
    .catch((e: unknown) => e);

  // Assert
  expect(error).to.be.instanceOf(BadRequestException);
  expect(markAccepted.mock.calls).to.have.lengthOf(1);
```

Es el mismo patrón de la diapositiva 14 (`action.Should().Throw<…>().WithMessage(…)`), adaptado a un método asíncrono. Si se quiere comprobar el mensaje, se añade `.and.have.property('message', '<texto exacto que lanza el service>')`.

`CLAUDE.md` pide no escribir comentarios que parafraseen el código. Los tres marcadores AAA son una excepción: forman parte de la convención que evalúa la asignatura.

La convención de nombres se mantiene (`'Camino N - …'`), porque traza cada prueba al camino de caja blanca del documento de V&V. La clase usa `Método_Condición_ResultadoEsperado`. Si el profesor lo exige, se puede usar ese formato en el `describe` y dejar el camino en el `it`.

### 7.2 Equivalencias con los métodos de la clase

La diapositiva 9 lista los métodos de Fluent Assertions. Estos son sus equivalentes en Chai dentro de Vitest:

| Fluent Assertions (C#) | Chai en Vitest | Uso típico en el proyecto |
|---|---|---|
| `x.Should().Be(y)` | `expect(x).to.equal(y)` | Rol del usuario creado al aceptar la invitación (CP-002) |
| `x.Should().NotBe(y)` | `expect(x).not.to.equal(y)` | El hash de contraseña cambió tras `changePassword` (CP-011) |
| `x.Should().BeEquivalentTo(y)` | `expect(x).to.deep.equal(y)` | Usuario autenticado devuelto por `validateCredentials` (CP-001) |
| `x.Should().BeNull()` / `NotBeNull()` | `expect(x).to.be.null` / `.not.to.be.null` | `lockedUntil` nulo tras un login correcto (CP-001) |
| `x.Should().BeEmpty()` | `expect(x).to.be.empty` | Auditoría filtrada sin coincidencias (CP-004, paso 8) |
| `x.Should().BeTrue()` | `expect(x).to.be.true` | `isActive` tras editar un producto (CP-005) |
| `x.Should().MatchRegex(r)` | `expect(x).to.match(r)` | Nombre de la acción auditada, `invitation.created` (CP-003) |
| `s.Should().StartWith(a).And.Contain(b)` | `expect(s).to.have.string(b)` + `.and` | Mensajes de error |
| `d.Should().BeBefore(otra)` | `expect(d.getTime()).to.be.below(otra.getTime())` | Registros de auditoría dentro del rango de fechas (CP-004) |
| Colecciones: `HaveCount`, `Contain` | `expect(lista).to.have.lengthOf(n)`, `.to.deep.include(item)` | Filtros `where` compuestos por `findPage` (CP-004) |
| `action.Should().Throw<E>().WithMessage(m)` | `expect(fn).to.throw(E, m)` | Funciones síncronas que lanzan |
| Excepción asíncrona | `const e = await p.catch((e) => e); expect(e).to.be.instanceOf(E).and.have.property('message', m)` | Credenciales inválidas, invitación ya usada, contraseña actual incorrecta, `caseSize` rechazado por el `ValidationPipe` (su `transform` es asíncrono) |

Alternativa más parecida a la sintaxis de C#: la interfaz `should` de Chai (`valor.should.equal(42)`), que se activa con `chai.should()` en un archivo de setup. No se recomienda: falla con `null` y `undefined`, justo los valores que más interesa comprobar, y necesita tipos adicionales en TypeScript.

### 7.3 Qué más falta

1. **Revisar que cada una de las seis funcionalidades** tenga pruebas cuyas aserciones verifiquen *resultados*: el usuario devuelto, el rol asignado, el filtro que se compone o la excepción lanzada. Comprobar solo que se llamó a un doble no basta para la rúbrica ("aserciones claras que verifican los resultados esperados").
2. **Aplicar AAA y el estilo fluido** (7.1 y 7.2) a las pruebas de las seis funcionalidades, en los dos repositorios.
3. **Generar un reporte JUnit** para que Jenkins muestre las pruebas en su interfaz:
   ```bash
   pnpm test:coverage --reporter=default --reporter=junit --outputFile.junit=reports/unit.xml
   ```
4. **Mantener la lista de coverage.** En los dos repositorios `coverage.include` de `vitest.config.mts` y `sonar.coverage.exclusions` de `sonar-project.properties` son complementarias: un archivo nuevo bajo prueba se añade a las dos.

---

## 8. Fase 3: pruebas de regresión

La Clase 13 define la regresión como las pruebas que aseguran que **los cambios en el código no afectaron negativamente las funcionalidades existentes**, volviendo a ejecutar casos que cubren esas funcionalidades después de cada modificación. Las diapositivas 18 y 19 enumeran seis tipos de pruebas de regresión automatizadas. Este plan arma una **suite de regresión por capas** con cuatro de ellos, que el pipeline ejecuta en cada build:

| Tipo según la clase | Herramienta que cita la clase | Qué se usa aquí | Proyecto |
|---|---|---|---|
| Pruebas de unidad automatizadas | JUnit, NUnit | Vitest: las pruebas unitarias de la Fase 2 se vuelven a ejecutar en cada cambio | API y front |
| Regresión de API | Postman, SoapUI | **Postman + Newman** contra la API levantada en Docker | API |
| Regresión de base de datos | Scripts automatizados, DBUnit | **Script SQL** que compara los datos antes y después de la suite y verifica su integridad | API |
| Regresión funcional (interfaz) | Selenium WebDriver, Cucumber | **Playwright**, que la tabla de librerías de la clase lista como herramienta end-to-end para JavaScript | Front |

Los otros dos tipos quedan fuera o se cubren de paso:

- **Integración:** la cubren de paso Newman y Playwright, porque ejercitan API, base de datos y front juntos.
- **Rendimiento (JMeter, LoadRunner):** fuera del alcance de la rúbrica. Si sobra tiempo, un plan de JMeter sobre `GET /audit-logs` con filtros (CP-004) sería el candidato natural: es la consulta más pesada de los seis casos.

Las capas de API, base de datos e interfaz prueban el **sistema levantado**, como caja negra, contra una base de datos **efímera** que nace y muere con cada build. Nunca contra Supabase.

### 8.1 API: Postman + Newman

**Postman** es la herramienta que la clase nombra para regresión de API. **Newman** es su ejecutor de línea de comandos, el que corre la misma colección dentro de Jenkins. Las pruebas de Postman usan `pm.expect`, que es Chai: el mismo estilo fluido de la Fase 2.

1. **Estructura:**
   - `regression/beverage-ledger-api.postman_collection.json`: una carpeta por caso de prueba (CP-001 a CP-011), en el orden del punto 4.
   - `regression/ci.postman_environment.json`: `baseUrl = http://api.ci.test:3001/api/v1`. La contraseña del admin **no** va en el archivo: se pasa al ejecutar con `--env-var`.
   - Dependencia: `pnpm add -D newman`.
   - Script nuevo:

     ```json
     "test:regression": "newman run regression/beverage-ledger-api.postman_collection.json -e regression/ci.postman_environment.json -r cli,junit --reporter-junit-export reports/regression-api.xml"
     ```

   - La colección se edita en la aplicación de Postman y se exporta al repositorio. Así se puede enseñar en la sustentación, petición por petición, qué paso de qué caso verifica.
   - Cada `pm.test` se nombra con el caso y el paso manual que automatiza (`'CP-002 paso 3: …'`). Así el reporte JUnit de Jenkins se lee directamente contra [casos-de-prueba.md](casos-de-prueba.md).

   Ejemplo: el paso 3 de CP-002, que en la ejecución manual quedó **no aprobado** ("se reutiliza el enlace"). La primera petición acepta la invitación:

   ```js
   pm.test('CP-002 paso 5: la invitación activa la cuenta', () => {
     pm.expect(pm.response.code).to.equal(201);
     pm.expect(pm.response.json()).to.have.nested.property('user.role', 'OPERATOR');
   });
   ```

   La siguiente repite exactamente la misma petición, con el mismo token:

   ```js
   pm.test('CP-002 paso 3: el enlace no se puede reutilizar', () => {
     pm.expect(pm.response.code).to.equal(404);
     pm.expect(pm.response.json().message).to.match(/no longer valid/i);
   });
   ```

   Según el código (`InvitationsRepository.findRedeemableByHash` solo encuentra invitaciones sin `acceptedAt`), la segunda aceptación debe responder 404. Si la prueba sale en rojo, reproduce el defecto que se encontró a mano. Si sale en verde, el defecto estaba en otra capa, probablemente el front, y hay que buscarlo con Playwright.

   Los nombres de campo del ejemplo son ilustrativos: hay que tomarlos del contrato OpenAPI (`/docs-json`).

2. **Stack efímero** `docker-compose.ci.yml`:

   ```yaml
   services:
     db:
       image: postgres:16-alpine
       environment:
         POSTGRES_USER: bl
         POSTGRES_PASSWORD: bl
         POSTGRES_DB: bl
       healthcheck:
         test: ['CMD-SHELL', 'pg_isready -U bl']
         interval: 2s
         retries: 30

     api:
       image: ${IMAGE}:${TAG}
       depends_on:
         db:
           condition: service_healthy
       environment:
         NODE_ENV: test
         DATABASE_URL: postgresql://bl:bl@db:5432/bl
         DIRECT_URL: postgresql://bl:bl@db:5432/bl
         JWT_SECRET: ${CI_JWT_SECRET}
         FRONTEND_URL: http://app.ci.test:3000
         CORS_ORIGINS: http://app.ci.test:3000
         SEED_ADMIN_PASSWORD: ${CI_ADMIN_PASSWORD}
       networks:
         default:
           aliases: [api.ci.test]
       healthcheck:
         test: ['CMD-SHELL', 'wget -qO- http://localhost:3001/api/v1/health || exit 1']
         interval: 3s
         retries: 40
   ```

   Sin puertos publicados: así dos builds simultáneos no chocan. El resto de variables toma sus valores por defecto (ver `.env.example`).

3. **Datos iniciales.** Tras levantar el stack, sembrar el catálogo con el admin activo:
   ```bash
   docker compose -p $CI_PROJECT -f docker-compose.ci.yml exec api pnpm db:seed
   ```
   El seed usa `tsx`, que es dependencia de desarrollo: la imagen debe conservarla (ver 10.1). Deja el admin activo, gracias a `SEED_ADMIN_PASSWORD`, y el catálogo de productos que necesita CP-005.

4. **Orden de las carpetas.** Desde el commit `dacb4cd` no hay registro abierto: solo se entra por invitación. Newman ejecuta las peticiones en orden y guarda tokens e ids en variables de colección, así que el orden de los casos resuelve las dependencias sin una carpeta de preparación aparte:

   1. **CP-001** entra como admin y guarda su token.
   2. **CP-003** crea una invitación y la acepta: de ahí sale un `OPERATOR`.
   3. **CP-002** repite el flujo del invitado, con otra invitación, y comprueba el uso único.
   4. **CP-004** consulta la auditoría que dejaron los tres casos anteriores.
   5. **CP-005** edita un producto del catálogo sembrado.
   6. **CP-011** cambia la contraseña del `OPERATOR` creado en CP-003. Va al final porque cierra sus sesiones.

5. **Qué automatiza cada carpeta.** Cada fila de la tabla de un caso manual se convierte en una o varias peticiones con su `pm.test`:

   | Caso | Pasos manuales automatizados | Qué verifica la regresión |
   |---|---|---|
   | CP-001 (RF-01) | COND-001 a COND-005 | Credenciales válidas: 200 con token, y `/auth/me` devuelve el rol y los permisos. Contraseña incorrecta (COND-002) y correo inexistente (COND-003): 401 con **el mismo mensaje**, para no revelar qué correos existen. Correo vacío (COND-004) y contraseña vacía (COND-005): 4xx y ningún token |
   | CP-003 (RF-29) | 1 a 4, 9 a 11 | Crear la invitación: 201 con el correo y el rol pedidos. El listado la muestra pendiente. Tras aceptarla, deja de estar pendiente. El usuario creado tiene el rol de la invitación. Un `OPERATOR` recibe 403 en `POST /invitations` |
   | CP-002 (RF-03) | 2 a 9, 11 | La vista previa (`/invitations/lookup`) muestra correo y rol. Aceptar crea la cuenta. **Reutilizar el enlace falla** (paso 3). El nuevo usuario entra con su contraseña, conserva el rol, puede leer el stock y recibe 403 en una ruta de admin. Vuelve a entrar sin el enlace (paso 11, también **no aprobado** a mano) |
   | CP-004 (RF-30) | 2 a 10 | Sin filtros devuelve registros. Filtrar por usuario solo devuelve ese usuario. Filtrar por rango de fechas solo devuelve registros dentro del rango, **incluido el último día** (paso 4, **no aprobado** a mano). Filtros combinados. Orden descendente por fecha. Un rango sin datos devuelve una lista vacía. Un `OPERATOR` recibe 403 |
   | CP-005 (RF-09) | 2 a 6, 8 | `PATCH /products/:id` con `caseSize` responde 400. Al releer el producto, `caseSize` no cambió. Un `PATCH` válido (nombre) responde 200 y tampoco toca `caseSize` |
   | CP-011 (RF-06) | 3 a 8 | Contraseña actual incorrecta: 401. Cambio correcto: 204. La cookie de refresh anterior ya no renueva la sesión (paso 7). La contraseña vieja se rechaza y la nueva entra (paso 8) |

   Hay pasos que no se automatizan:
   - **Usabilidad** (CP-002 paso 10, CP-003 paso 12): son un juicio humano.
   - **Envío por correo** (CP-003 paso 5): no existe en el proyecto; el admin copia el enlace a mano.

### 8.2 API: regresión de base de datos

La clase describe esta capa como la que asegura que los cambios en el código **no afectaron la integridad y consistencia de los datos**, con scripts automatizados o herramientas de comparación de datos como DBUnit. Aquí se hacen las dos cosas con SQL, en dos momentos:

1. **Antes de Newman**, `regression/db-snapshot.sql` guarda una foto de lo que ningún caso debe alterar:

   ```sql
   CREATE TABLE ci_snapshot_case_size AS
   SELECT id, case_size FROM products;
   ```

2. **Después de Newman**, `regression/db-integrity.sql` compara con la foto y verifica las reglas de los seis casos. Aborta con error si alguna falla:

   ```sql
   DO $$
   DECLARE
     changed_case_sizes int;
     orphan_acceptances int;
     live_sessions_after_password_change int;
     unaudited_acceptances int;
   BEGIN
     -- CP-005 / RN-09: no product changed its units per case.
     SELECT COUNT(*) INTO changed_case_sizes
     FROM products p
     JOIN ci_snapshot_case_size s ON s.id = p.id
     WHERE p.case_size <> s.case_size;

     -- CP-002 / CP-003: every accepted invitation produced exactly one member.
     SELECT COUNT(*) INTO orphan_acceptances
     FROM invitations i
     WHERE i.accepted_at IS NOT NULL
       AND (SELECT COUNT(*) FROM users u
            WHERE u.organization_id = i.organization_id AND u.email = i.email) <> 1;

     -- CP-011: no session issued before a password change is still usable.
     SELECT COUNT(*) INTO live_sessions_after_password_change
     FROM refresh_tokens rt
     JOIN audit_logs a ON a.entity = 'user' AND a.entity_id = rt.user_id::text
                      AND a.action = 'user.password-changed'
     WHERE rt.revoked_at IS NULL
       AND rt.expires_at > now()
       AND rt.created_at < a.created_at;

     -- CP-004: the trail the audit screen reads is complete for acceptances.
     SELECT COUNT(*) INTO unaudited_acceptances
     FROM invitations i
     WHERE i.accepted_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM audit_logs a
                       WHERE a.action = 'invitation.accepted' AND a.entity_id = i.id::text);

     IF changed_case_sizes + orphan_acceptances + live_sessions_after_password_change + unaudited_acceptances > 0 THEN
       RAISE EXCEPTION 'Data integrity broken: % case sizes changed, % orphan acceptances, % live sessions after a password change, % unaudited acceptances',
         changed_case_sizes, orphan_acceptances, live_sessions_after_password_change, unaudited_acceptances;
     END IF;
   END $$;
   ```

Los dos se ejecutan desde el pipeline contra el contenedor de la base, con el mismo comando y cambiando el archivo:

```bash
docker compose -p $CI_PROJECT -f docker-compose.ci.yml exec -T db \
  psql -U bl -d bl -v ON_ERROR_STOP=1 < regression/db-integrity.sql
```

Esta capa atrapa lo que una respuesta HTTP no muestra. Por ejemplo, si `changePassword` responde 204 pero deja de revocar las sesiones, Newman solo lo nota si prueba justo esa cookie. En cambio, el script revisa todas las sesiones de la base.

Los nombres de columna salen de `prisma/schema.prisma`. `AuditService.record()` es best-effort (`CLAUDE.md` §2): si la auditoría fallara de forma aislada, la cuarta comprobación lo señalaría, y eso también es una regresión que vale la pena ver.

### 8.3 Front: Playwright (regresión funcional)

La clase cita Selenium WebDriver para la regresión funcional de aplicaciones web. Su tabla de librerías de JavaScript/TypeScript lista **Playwright** (y Cypress) como herramientas end-to-end equivalentes: automatizan el navegador igual que Selenium, con menos configuración. Se elige Playwright porque trae su propio runner, reporte JUnit y trazas de cada fallo.

1. **Instalación:** `pnpm add -D @playwright/test` y `playwright.config.ts` con `baseURL: 'http://app.ci.test:3000'`, `workers: 1` y el reporter JUnit.
2. **Estructura:** `e2e/*.spec.ts`, un archivo por funcionalidad. **Excluir `e2e/**` en `vitest.config.mts`**: el include por defecto de Vitest también atrapa los `*.spec.ts`.
3. **Flujos:** un archivo por caso, de `e2e/cp-001-login.spec.ts` a `e2e/cp-011-change-password.spec.ts`, siguiendo los pasos de la tabla manual:
   - **CP-001:** el formulario aparece; con credenciales válidas se llega al panel; con credenciales inválidas aparece el error y no se sale de la pantalla de login; con campos vacíos el formulario no se envía.
   - **CP-002:** abrir el enlace de invitación, crear la contraseña y llegar al panel. Luego volver a abrir el mismo enlace y comprobar que se muestra el aviso de enlace inválido: es donde más probablemente vive el defecto del paso 3.
   - **CP-003:** el admin abre el diálogo de invitación, genera el enlace, y la invitación aparece como pendiente en la tarjeta de invitaciones.
   - **CP-004:** aplicar los filtros de usuario y de fechas en la vista de auditoría y comprobar que cada fila visible cumple el filtro. Limpiar filtros. Comprobar el mensaje de "sin resultados".
   - **CP-005:** abrir el diálogo de edición de un producto y comprobar que el campo de unidades por caja **no es editable**.
   - **CP-011:** cambiar la contraseña desde el perfil, comprobar que la sesión se cierra, y entrar con la nueva.

   Usar `getByRole` y `getByLabel`, no selectores CSS, para que la suite no se rompa con cambios de estilo. Basta con Chromium: el equipo ejecutó los casos manuales en Microsoft Edge, que usa el mismo motor.
4. **Sesión reutilizada:** entrar una vez por rol en un *global setup* y guardar el `storageState`, en lugar de hacer login en cada prueba (ver 12, límite de peticiones).
5. **Stack:** el mismo `docker-compose.ci.yml` de la API, más un servicio `web` con la imagen del front y el alias `app.ci.test`. La API se toma de Docker Hub con un tag fijo.

### 8.4 Por qué los alias `app.ci.test` y `api.ci.test`

La cookie de refresh se emite con `SameSite=Lax` fuera de producción, así que el navegador solo la envía si el front y la API son *same-site*:

- Con `web` y `api` como nombres de host, son sitios distintos y la sesión no se restaura.
- Con `app.ci.test` y `api.ci.test` comparten el dominio registrable `ci.test` y la cookie viaja.
- `NODE_ENV` debe ser `test`: con `production` la cookie sale `Secure` y no viaja por `http`.
- `NEXT_PUBLIC_API_URL` se incrusta al **construir** el front, así que la imagen de CI se construye con `http://api.ci.test:3001`.

### 8.5 Cómo corre la regresión dentro de Jenkins

Jenkins comparte el socket de Docker del host. Si una prueba se ejecuta en otro contenedor montando `$WORKSPACE`, falla, porque esa ruta existe dentro del contenedor de Jenkins pero no en el host.

La solución es ejecutar las pruebas **desde el propio contenedor de Jenkins** y conectarlo a la red del stack:

```bash
docker network connect ${CI_PROJECT}_default jenkins
# ... ejecutar las pruebas contra http://api.ci.test:3001 ...
docker network disconnect ${CI_PROJECT}_default jenkins
```

Por eso la imagen de Jenkins trae Node y las dependencias de Chromium (6.1). Los navegadores se descargan en el pipeline con `pnpm exec playwright install chromium`, para que coincidan con la versión de `@playwright/test`.

### 8.6 Demostrar que detecta un cambio

Es el punto que separa 12 de 20 en la rúbrica ("demuestra que permite verificar su funcionamiento después de un cambio") y lo que la Clase 13 describe como el objetivo de la regresión: volver a ejecutar los mismos casos después de una modificación para ver si algo que funcionaba dejó de hacerlo.

1. **Línea base:** ejecutar el pipeline en `main`. Todo queda en verde.
2. **Cambio:** en una rama, introducir un fallo deliberado.
3. **Detección:** ejecutar el pipeline. La capa correspondiente queda en rojo y el reporte JUnit señala qué funcionalidad se rompió.
4. **Corrección:** revertir el fallo y ver que vuelve a verde.

Conviene elegir fallos que muestren que **cada capa atrapa algo distinto**:

| Fallo introducido | Caso | Capa que lo detecta | Por qué |
|---|---|---|---|
| Dar mensajes distintos para "correo inexistente" y "contraseña incorrecta" en `CredentialsService` | CP-001 | Unitarias y Newman | Los caminos 1 y 5 de `rf-01` esperan el mismo error, y la colección compara los dos mensajes |
| Quitar `acceptedAt: null` del filtro de `findRedeemableByHash` | CP-002 | Newman y script SQL | El enlace se puede reutilizar: la segunda aceptación ya no responde 404 |
| Quitar `revokeAllForUser` de `changePassword` | CP-011 | Unitarias (camino 5 de `rf-06`), Newman y script SQL | La cookie antigua sigue renovando la sesión, y quedan sesiones vivas anteriores al cambio |
| Añadir `caseSize` a `UpdateProductDto` | CP-005 | Unitarias (la prueba nueva de 5.1), Newman y script SQL | El `PATCH` con `caseSize` pasa a responder 200, y el producto ya no coincide con la foto previa |
| Cambiar `lte` por `lt` en el filtro de fechas de `AuditRepository.findPage` | CP-004 | Unitarias (camino 6 de `rf-30`) y Newman | Los registros del instante final del rango desaparecen |
| Hacer editable el campo de unidades por caja en el diálogo de producto | CP-005 | Playwright | La API sigue rechazando el cambio; lo roto es la interfaz, que ahora promete algo que no puede cumplir |

La ejecución manual ya encontró defectos: CP-002 pasos 3 y 11, y CP-004 paso 4. Son los mejores candidatos para la sustentación. Si la suite los reproduce en rojo, la corrección se demuestra con el mismo pipeline en verde, sin necesidad de inventar un fallo.

Guardar capturas de las ejecuciones: la línea base, cada fallo detectado y la corrección.

---

## 9. Fase 5: despliegue y arranque

### 9.1 Mínimo que cumple la rúbrica: staging local

Un `docker-compose.deploy.yml` en cada repositorio que levanta la imagen recién publicada con puertos publicados (`3001` la API, `3000` el front) y una base de datos persistente. La etapa de despliegue:

```bash
TAG=$TAG docker compose -f docker-compose.deploy.yml pull
TAG=$TAG docker compose -f docker-compose.deploy.yml up -d
curl --retry 10 --retry-connrefused -f http://host.docker.internal:3001/api/v1/health
```

El smoke test usa `host.docker.internal` y no `localhost`, porque se ejecuta dentro del contenedor de Jenkins.

### 9.2 Opcional: nube

- **API en Render.** El servicio de tipo *Deploy an existing image* de la cuenta del equipo (3.3) se dispara desde Jenkins con su *Deploy Hook*:
  ```bash
  curl -X POST "$RENDER_DEPLOY_HOOK&imgURL=docker.io/<usuario>/beverage-ledger-api:$TAG"
  ```
  Verificar en la documentación de Render que el plan gratuito admite servicios basados en imagen.
- **Front en Vercel.** Vercel **no ejecuta imágenes Docker**: construye desde el código. El despliegue se hace con la CLI:
  ```bash
  pnpm dlx vercel deploy --prod --token "$VERCEL_TOKEN"
  ```
  La imagen del front queda para el staging local y el registro. En la sustentación conviene explicar esta diferencia.
- **Base de datos.** El proyecto de Supabase de la cuenta del equipo (3.3). Las migraciones se aplican al arrancar el contenedor de la API (10.1).

---

## 10. Fase 4: imágenes Docker

### 10.1 API

`Dockerfile` multi-stage sobre `node:22-alpine`. Puntos que no son obvios:

- **Orden de copia.** `pnpm install` dispara el `postinstall` del repositorio, que ejecuta `prisma generate`. Antes del install hay que copiar `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `prisma/` y `prisma.config.ts`.
- **Variables falsas en el build.** `prisma.config.ts` lanza si falta `DIRECT_URL`. Durante el build se da una URL sintácticamente válida, igual que hace `.github/workflows/sonar.yml`. Ninguna credencial real entra en la imagen.
- **Dependencias de desarrollo.** El seed (`tsx`) y `prisma migrate deploy` (CLI de `prisma`) son devDependencies. Lo más simple para la actividad es conservar `node_modules` completo en la imagen final. Si se quiere una imagen más pequeña, construir un *target* `ci` aparte para la regresión.
- **Arranque:** `prisma migrate deploy && node dist/main`. `migrate deploy` es idempotente.

Esqueleto:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build \
    DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY --from=build /app ./
EXPOSE 3001
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main"]
```

Añadir un `.dockerignore` con `node_modules`, `dist`, `coverage`, `.env` y `.git`.

### 10.2 Front

- Añadir `output: 'standalone'` en `next.config.ts`: la imagen final solo lleva `.next/standalone`, `.next/static` y `public`.
- `NEXT_PUBLIC_API_URL` como `ARG` del build, porque Next.js lo incrusta en el bundle. Hay una imagen por destino: la de CI con `http://api.ci.test:3001` y la de staging con `http://localhost:3001`.
- **Doble lockfile:** el front tiene `package-lock.json` y `pnpm-lock.yaml`. El gestor declarado es pnpm, así que hay que borrar `package-lock.json` antes de construir la imagen.

### 10.3 Publicación

Cada build publica en Docker Hub dos tags: el hash corto del commit (`${GIT_COMMIT[0..7]}`), que es inmutable y el que usa el despliegue, y `latest`.

---

## 11. Fase 6: `Jenkinsfile`

### 11.1 API

```groovy
pipeline {
  agent any

  environment {
    IMAGE      = 'usuario/beverage-ledger-api'
    TAG        = "${env.GIT_COMMIT.take(7)}"
    CI_PROJECT = "bl-api-ci-${env.BUILD_NUMBER}"
  }

  stages {
    stage('Install') {
      steps { sh 'corepack enable && pnpm install --frozen-lockfile' }
    }

    stage('Lint & typecheck') {
      steps { sh 'pnpm lint && pnpm typecheck' }
    }

    stage('Build') {
      steps { sh 'pnpm build' }
    }

    stage('Unit tests') {
      steps {
        sh 'pnpm test:coverage --reporter=default --reporter=junit --outputFile.junit=reports/unit.xml'
      }
    }

    stage('Docker image') {
      steps { sh 'docker build -t $IMAGE:$TAG .' }
    }

    stage('Regression') {
      steps {
        sh 'docker compose -p $CI_PROJECT -f docker-compose.ci.yml up -d --wait'
        sh 'docker compose -p $CI_PROJECT -f docker-compose.ci.yml exec -T api pnpm db:seed'
        sh 'docker network connect ${CI_PROJECT}_default jenkins'
        // Database regression, part one: snapshot what no test case may change.
        sh 'docker compose -p $CI_PROJECT -f docker-compose.ci.yml exec -T db psql -U bl -d bl -v ON_ERROR_STOP=1 < regression/db-snapshot.sql'
        // API regression: the Postman collection, one folder per test case.
        sh 'pnpm test:regression --env-var adminPassword=$CI_ADMIN_PASSWORD'
        // Database regression, part two: compare against the snapshot and check integrity.
        sh 'docker compose -p $CI_PROJECT -f docker-compose.ci.yml exec -T db psql -U bl -d bl -v ON_ERROR_STOP=1 < regression/db-integrity.sql'
      }
      post {
        always {
          sh 'docker network disconnect ${CI_PROJECT}_default jenkins || true'
          sh 'docker compose -p $CI_PROJECT -f docker-compose.ci.yml down -v'
        }
      }
    }

    stage('SonarQube') {
      steps {
        withSonarQubeEnv('sonarqube') {
          sh 'pnpm dlx sonar-scanner -Dsonar.projectKey=beverage-ledger-api'
        }
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('Publish image') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DH_USER', passwordVariable: 'DH_TOKEN')]) {
          sh '''
            echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin
            docker push $IMAGE:$TAG
            docker tag $IMAGE:$TAG $IMAGE:latest
            docker push $IMAGE:latest
          '''
        }
      }
    }

    stage('Deploy') {
      steps {
        sh 'TAG=$TAG docker compose -f docker-compose.deploy.yml up -d'
        sh 'curl --retry 10 --retry-connrefused -f http://host.docker.internal:3001/api/v1/health'
      }
    }
  }

  post {
    always {
      junit allowEmptyResults: true, testResults: 'reports/*.xml'
      archiveArtifacts allowEmptyArchive: true, artifacts: 'coverage/**'
    }
  }
}
```

Notas:

- **`CI_JWT_SECRET` y `CI_ADMIN_PASSWORD`** para el stack de regresión se definen como credenciales de Jenkins y se inyectan con `withCredentials`, o se generan al vuelo en el propio build: la base es efímera.
- **Scanner.** Con `sonar-project.properties` ya ajustado en el fork (3.2), el `-Dsonar.projectKey` de la línea de comandos sobra, aunque no estorba. En vez de `pnpm dlx sonar-scanner`, también se puede registrar *SonarQube Scanner* como *tool* en Jenkins.
- **Quality gate.** En el primer análisis el gate por defecto puede fallar por el coverage del código nuevo. Si bloquea la demostración, se puede usar `abortPipeline: false` y mostrar el resultado igualmente.

### 11.2 Front

Mismo esqueleto, con estas diferencias:

- **Imagen de CI:** `docker build --build-arg NEXT_PUBLIC_API_URL=http://api.ci.test:3001 -t $IMAGE:ci-$TAG .`
- **Regresión:** el stack incluye `web`; antes de las pruebas, `pnpm exec playwright install chromium`; luego `pnpm exec playwright test` con reporter JUnit. Publicar además el reporte HTML de Playwright con HTML Publisher: incluye trazas y capturas de los fallos.
- **Imagen publicada:** otra construcción con la URL del destino real (`http://localhost:3001` para staging).
- **Deploy:** staging local con compose y, opcionalmente, `vercel deploy`.

---

## 12. Trampas conocidas

- **Límite de peticiones en autenticación.** `AUTH_THROTTLE` (`src/modules/auth/auth.throttle.ts`) permite **10 peticiones por minuto** por IP en login, refresh y las rutas públicas de invitación. Está fijado en código, no en el entorno. Todas las pruebas de regresión salen de la misma IP, y cinco de los seis casos son de autenticación, así que este límite es el riesgo más probable de un 429 en la suite.

  La cuenta aproximada de `POST /auth/login` en la colección de Newman ya roza el límite:
  - CP-001: 5 (un login válido y cuatro condiciones de error).
  - CP-002: 2 (pasos 6 y 11).
  - CP-011: 2 (contraseña vieja y nueva).
  - Algún login más si CP-003 no reutiliza la sesión que devuelve la aceptación.

  Mitigaciones, de menor a mayor impacto:
  1. Entrar una vez por rol y reutilizar el token (variable de colección en Postman) o el `storageState` (Playwright).
  2. Navegar dentro de la SPA en lugar de recargar la página, porque cada carga completa pide `/auth/refresh`.
  3. Poner una pausa antes de la carpeta CP-011: una petición cuyo *pre-request script* sea `setTimeout(() => {}, 60000)`. Suma un minuto a la suite y no toca el código.
  4. Si aun así no alcanza, añadir un `skipIf` al throttler, controlado por una variable que solo tenga efecto cuando `NODE_ENV !== 'production'`. Es un cambio de código en la API y debe acordarse con el equipo.
- **Bloqueo de cuenta.** Tras `LOGIN_MAX_ATTEMPTS` (5) intentos fallidos, la cuenta queda bloqueada `LOGIN_LOCKOUT_MINUTES` (15). En CP-001, COND-002 puede usar el admin: es un solo intento fallido, y el siguiente login correcto reinicia el contador (`AuthRepository`, `failedLoginAttempts: 0`). Lo que no se debe hacer es acumular cinco fallos seguidos sobre el mismo usuario.
- **El cliente de Prisma se genera.** `src/generated/prisma` está en `.gitignore` y varias pruebas unitarias importan sus enums: sin `pnpm install` (o `pnpm db:generate`) la suite ni carga.
- **`vm.max_map_count`.** Si SonarQube se reinicia en bucle, casi siempre es este ajuste (6.2), que se pierde al reiniciar Docker Desktop.
- **Rutas del workspace.** Nunca montar `$WORKSPACE` en un contenedor lanzado desde Jenkins (8.5).
- **`localhost` dentro de Jenkins** es el propio contenedor, no el host. Para llegar a los puertos publicados se usa `host.docker.internal`.
- **Despliegues en paralelo a Jenkins.** Si el servicio de Render se crea desde el Blueprint o el proyecto de Vercel se conecta a GitHub, cada push despliega por su cuenta y Jenkins deja de controlar el despliegue (3.3).
- **Push al repositorio equivocado.** Mientras `origin` apunte al original, un `git push` intenta subir a él. Reapuntar los remotos antes de cualquier commit (3.4).

---

## 13. Orden de trabajo recomendado

1. **Fase 0:** forks, remotos reapuntados y cuentas de Docker Hub, Render, Vercel y Supabase. Ajustar en el fork `sonar-project.properties` y el workflow de SonarCloud (3.2).
2. **Fase 1:** `ci/` con Jenkins y SonarQube funcionando, con un job de prueba que solo haga `pnpm install` y `pnpm build`.
3. **API completa:** Dockerfile → pruebas unitarias revisadas → regresión → `Jenkinsfile` → publicación → despliegue.
4. **Front completo**, que depende de que la imagen de la API ya esté publicada en Docker Hub.
5. **Evidencia** para la sustentación (sección 14).
6. **Documentación:** actualizar el `CLAUDE.md` de cada fork, que hoy dice que las pruebas no tocan base de datos, que no hay imagen Docker propia y que el despliegue es el del proyecto original.

---

## 14. Evidencia para la sustentación

| Qué mostrar | Dónde |
|---|---|
| Todas las etapas en verde, en los dos pipelines | *Stage View* de cada job en Jenkins |
| Patrón AAA, dobles y Fluent Assertions | Dos o tres pruebas abiertas en el editor, comparadas con la tabla de 7.2 |
| Pruebas unitarias y de regresión separadas por suite | Reporte JUnit del build |
| Regresión de API | La colección de Postman, carpeta por funcionalidad |
| La regresión detectando un fallo | Línea base → fallo detectado → corrección (8.6) |
| Análisis estático y quality gate | Dashboard de SonarQube |
| Imágenes publicadas | Tags en Docker Hub |
| Aplicación arrancada | Staging local y, si aplica, URLs de Render y Vercel |
| Integridad de los datos | Salida del script SQL de integridad (8.2) |
| Trazabilidad | Nombres de las pruebas (`CP-00X paso N`) frente a [casos-de-prueba.md](casos-de-prueba.md), y los defectos manuales reproducidos y corregidos |
| Métricas de calidad | Sección 15 |

---

## 15. Métricas de calidad (Clase 13)

La Clase 13 define las métricas como estándares de medición del progreso y la calidad del proceso de pruebas. Casi todas salen de herramientas que el pipeline ya ejecuta, así que en la sustentación se pueden mostrar con datos reales y no como teoría.

### 15.1 Métricas del código

| Métrica de la clase | De dónde sale | Cómo mostrarla |
|---|---|---|
| **Complejidad ciclomática** (dificultad para probar el código) | SonarQube, *Measures → Complexity → Cyclomatic Complexity* | Relacionarla con las pruebas de caja blanca: cada camino `Camino N` de las pruebas corresponde a un camino independiente del método |
| **Complejidad cognitiva** (dificultad para entender el código) | SonarQube, *Measures → Complexity → Cognitive Complexity* | Señalar los archivos con el valor más alto |
| **Duplicación de código** | SonarQube, *Measures → Duplications* | Porcentaje de líneas duplicadas y bloques concretos |
| **Código muerto** | SonarQube (reglas de imports, variables y funciones sin usar) y el coverage | La clase dice que es "más fácil de detectar con pruebas automatizadas": las líneas en rojo del reporte de coverage de un archivo bajo prueba son candidatas |
| **Acoplamiento y cohesión** | No hay una cifra directa en SonarQube Community; se argumentan con la arquitectura | La cadena controller → service → repository (`CLAUDE.md` §5) mantiene bajo el acoplamiento: por eso los services se prueban con dobles de sus repositorios, sin base de datos. Cada service tiene un solo caso de uso por método (cohesión, SRP) |
| **Code churn** (frecuencia de cambio de un archivo) | Historial de git | `git log --since="3 months ago" --name-only --format= -- src \| sort \| uniq -c \| sort -rn \| head` lista los archivos más modificados. Si coinciden con los que tienen pruebas, se justifica dónde se puso el esfuerzo |

### 15.2 Métricas del proceso de pruebas

Del glosario de la clase, estas se calculan directamente con los reportes JUnit del pipeline:

| Métrica | Fórmula (Clase 13) | Fuente |
|---|---|---|
| Porcentaje de casos aprobados | (Aprobadas / Ejecutadas) × 100 | Reporte JUnit de Jenkins, por suite |
| Porcentaje de casos fallidos | (Fallidas / Ejecutadas) × 100 | Ídem; en el build con el fallo introducido (8.6) deja de ser 0 |
| Porcentaje de casos bloqueados | (Bloqueadas / Ejecutadas) × 100 | Pruebas omitidas (`skipped`) del reporte |
| Pruebas ejecutadas por período | Ejecutadas / Tiempo total | Número de pruebas y duración de cada etapa en Jenkins |
| Porcentaje de defectos reparados | (Reparados / Informados) × 100 | Los fallos introducidos en 8.6 y su corrección |
| Tiempo medio de reparación | Tiempo de corrección / Número de errores | Tiempo entre el build rojo y el siguiente verde |

Conviene llevar a la sustentación una tabla con estas cifras por proyecto, tomadas del último build verde y del build con el fallo introducido.
