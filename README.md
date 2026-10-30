# DuckBot 🦆

Bot de Discord para una comunidad: cada miembro adopta hasta 3 patos en pixel art, los viste con cosméticos, los entrena
y compite en carreras animadas. La moneda del juego, las **PatoCoins**, se gana escribiendo en el servidor, con un
check-in diario y en las carreras.

Los patos se dibujan con el mismo código que **duck-editor**, el editor de sprites de patos del mismo autor, y pueden
salir al azar o elegirse de un catálogo (un script genera uno de 145 aves de México). El bot está en **español e inglés** (según el idioma
de cada usuario en Discord).

<p align="center">
  <img src="assets/media/gallery.png" alt="Galería de patos con cosméticos" width="420">
  <img src="assets/media/race.gif" alt="Carrera de patos" width="420">
</p>

## Qué hace

- **Adopción:** pato aleatorio (pulsa **Otro** las veces que quieras) o del catálogo. A veces sale un pato que se quedó
  sin dueño porque su dueño dejó el servidor, con su cosmético puesto.
- **Galería:** todos los patos del servidor en una cuadrícula numerada, con tarjeta animada de cada pato.
- **Progresión:** los mensajes dan XP al jugador; cada nivel nuevo da PatoCoins. Cada pato tiene además su propio
  nivel, que se sube pagando con PatoCoins.
- **Carreras:** hasta 8 patos, con GIF de la carrera. Si no hay más jugadores, los carriles libres los ocupan patos del
  bot, así que se puede correr solo.
- **Tienda y vestuario:** cosméticos para probar en tu pato antes de comprarlos, cada uno en 12 colores. El arte de los
  cosméticos se carga de un archivo; el repositorio trae solo 8 gorras de ejemplo (la blanca y una de cada color del arcoíris; ver
  [El arte](#el-arte)).
- **Economía:** check-in diario, transferencias entre miembros y saldo privado.
- **Staff:** eventos de XP ×1.5/×2/×3, precios, regalos de cosméticos o monedas, y cosméticos ligados a un rol.
- **Privado por defecto:** las respuestas solo las ve quien usa el comando. Las carreras y las subidas de nivel son
  públicas, y las subidas de nivel se anuncian en un canal propio.

## Comandos

### Para todos

| Comando (inglés / español)                  | Qué hace                                                                                                                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/ping`                                     | Comprueba que el bot responde y muestra la latencia.                                                                                                                                                                                           |
| `/adopt` · `/adoptar` `nombre` `[catalogo]` | Adopta un pato (hasta 3): aleatorio o eligiendo uno del catálogo.                                                                                                                                                                              |
| `/duck` · `/pato` `[usuario]` `[pato]`      | Abre la **galería** (12 patos por página, ◀ ▶ y un menú para abrir cualquiera). En la tarjeta de un pato, ◀ ▶ pasan entre los patos de su dueño. En tus patos aparece **👕 Vestuario** para ponerles, quitarles o cambiar de color cosméticos. |
| `/rename` · `/renombrar` `nombre` `[pato]`  | Cambia el nombre de uno de tus patos.                                                                                                                                                                                                          |
| `/release` · `/liberar` `pato`              | Libera a uno de tus patos. Pide confirmación y devuelve la mitad de lo invertido en entrenarlo.                                                                                                                                                |
| `/train` · `/entrenar` `[pato]`             | Gasta PatoCoins para subir un nivel a uno de tus patos (más nivel = más rápido en las carreras).                                                                                                                                               |
| `/shop` · `/tienda` `[pato]`                | Un cosmético cada vez, con ◀ ▶ y vista previa en tu pato. **🛒 Comprar** y **🦆 Ponérselo**.                                                                                                                                                   |
| `/race` · `/carrera` `[pato]`               | Abre una carrera: 60 s para unirse. Luego sale el GIF y se reparten PatoCoins.                                                                                                                                                                 |
| `/daily` · `/diario`                        | Check-in diario: 25 PatoCoins una vez al día.                                                                                                                                                                                                  |
| `/balance` · `/saldo`                       | Tu saldo y tu nivel de jugador.                                                                                                                                                                                                                |
| `/pay` · `/transferir` `usuario` `cantidad` | Envía PatoCoins a otro miembro (con confirmación).                                                                                                                                                                                             |

### Para el staff

| Comando                                                        | Qué hace                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/evento crear` `multiplicador` `horas` `[canal]`              | Multiplicador de XP (×1.5, ×2 o ×3) en un canal o en todo el servidor.                               |
| `/evento terminar` `evento`                                    | Termina un evento antes de tiempo (al escribir, sugiere los activos).                                |
| `/cosmeticos precio` `cosmetico` `[precio]`                    | Cambia el precio de un cosmético. Sin precio, lo quita de la tienda (quien ya lo tiene lo conserva). |
| `/cosmeticos dar` · `/cosmeticos quitar` `usuario` `cosmetico` | Regala o quita un cosmético a alguien.                                                               |
| `/cosmeticos rol` `cosmetico` `[rol]`                          | Quien tenga ese rol tiene el cosmético sin comprarlo. Sin rol, se quita el vínculo.                  |
| `/monedas dar` · `/monedas quitar` `usuario` `cantidad`        | Suma o resta PatoCoins (el saldo nunca baja de 0).                                                   |

**Quién puede usarlos:** por defecto, solo quien tiene _Gestionar servidor_. Para dárselos a un rol (por ejemplo
"Moderador"):

1. Ve a **Ajustes del servidor → Integraciones → DuckBot**.
2. Entra en el comando (`/cosmeticos`, `/monedas` o `/evento`).
3. Pulsa **Añadir roles o miembros**, elige el rol y marca ✅.

Cada comando se configura por separado.

**Tareas automáticas:** al arrancar y cada 6 horas, el bot:

- pone a la venta los cosméticos nuevos;
- deja sin dueño los patos de quien salió del servidor;
- borra los movimientos de PatoCoins de hace más de 30 días.

## Reglas del juego

- **Hasta 3 patos por persona.** Para adoptar otro hay que liberar uno. Los nombres tienen de 1 a 20 caracteres y no
  se pueden repetir entre tus patos. Nadie puede renombrar, entrenar, vestir ni liberar el pato de otra persona.
- **Nivel del jugador:**
  - Cada mensaje da **10 XP**, como mucho una vez por minuto.
  - Hacen falta 100 XP para el nivel 2, 1 000 para el 5 y 4 500 para el 10.
  - Cada nivel nuevo da **nivel × 10 PatoCoins** y se anuncia en el canal `#duckbot`.
- **Nivel del pato (1 a 20):**
  - Solo sube con `/entrenar`, pagando **nivel actual × 50 PatoCoins** (de 1 a 20 cuesta 9 500 en total).
  - Cuenta en las carreras: da hasta un +10 % de velocidad.
- **Carreras:**
  - Máximo **10 al día** por servidor, y una abierta a la vez.
  - Siempre corren 8 patos. Los del bot corren al nivel medio de los jugadores y no ganan premio.
  - Premios con un solo jugador: 🥇 50, 🥈 30, 🥉 20 y 10 para el resto. **Cada jugador extra los sube un 25 %.**
  - Cada pato tiene una "forma del día", así que cualquiera puede ganar.
- **Economía:**
  - Un jugador normal gana unas 80–100 🪙 al día.
  - Cada cosmético cuesta 150 🪙 (el staff puede cambiar el precio).
  - Al liberar un pato se devuelve la mitad de lo invertido en entrenarlo.
- **Patos sin dueño:**
  - Si alguien deja el servidor, sus patos vuelven al nivel 1 y conservan su cosmético.
  - Al adoptar al azar, hay un 25 % de probabilidad de que salga uno de ellos.
- **Rol de adoptador:** quien tiene pato recibe el rol **Adoptador de patos** (el bot lo crea si no existe) y lo pierde
  al liberar el último.
- Todos los valores ajustables están en [`packages/core/src/rules.ts`](packages/core/src/rules.ts).

## Instalación

### 1. Requisitos

- **Node.js 22.12 o superior**.
- **pnpm 10**: `npm install -g pnpm@10`.
- En Windows, si `pnpm` "no se reconoce como comando", añade `%APPDATA%\npm` al `Path` de tu usuario y abre una
  terminal nueva.

No hace falta Docker: la base de datos es un archivo SQLite (`data/duckbot.db`).

### 2. Crear el bot en Discord

El **Developer Portal solo está en inglés**. Por eso los botones aparecen con su nombre en inglés y la traducción entre
paréntesis.

1. En <https://discord.com/developers/applications>, pulsa **New Application** (_Nueva aplicación_), ponle un nombre y
   pulsa **Create** (_Crear_).
2. En **General Information** (_Información general_), copia el **Application ID** (_ID de la aplicación_): es tu
   `DISCORD_CLIENT_ID`.
3. En **Bot**, pulsa **Reset Token** (_Restablecer token_) y copia el token: es tu `DISCORD_TOKEN`.
   - Solo se muestra una vez.
   - En **Privileged Gateway Intents** (_Intents privilegiados_) **no actives nada**.
4. Invita el bot con esta URL, cambiando `TU_CLIENT_ID` por el número del paso 2:

   ```
   https://discord.com/oauth2/authorize?client_id=TU_CLIENT_ID&scope=bot+applications.commands&permissions=268487680
   ```

   Esa URL le da estos permisos: Ver canales, Enviar mensajes, Insertar enlaces, Adjuntar archivos y Gestionar roles.

5. En tu servidor, **Ajustes del servidor → Roles**: arrastra el rol del bot por encima de **Adoptador de patos**.
   Discord no deja a un bot dar roles que estén por encima del suyo.
6. Crea un canal de texto **#duckbot** para los avisos de nivel.
7. Activa **Ajustes de usuario → Avanzado → Modo desarrollador**. Luego haz clic derecho en tu servidor y elige
   **Copiar ID del servidor**: es tu `DISCORD_DEV_GUILD_ID`.

> ⚠️ El token es la contraseña del bot. Va solo en `.env`, que no se sube a git. Si se filtra, regenéralo en el portal.

### 3. Configurar y arrancar

```bash
pnpm install
cp .env.example .env    # en Windows: copy .env.example .env
```

Rellena en `.env` los tres valores de Discord. El resto tiene valores por defecto:

| Variable               | Para qué                                                             | Por defecto              |
| ---------------------- | -------------------------------------------------------------------- | ------------------------ |
| `DISCORD_TOKEN`        | Token del bot                                                        | —                        |
| `DISCORD_CLIENT_ID`    | ID de la aplicación                                                  | —                        |
| `DISCORD_DEV_GUILD_ID` | Servidor donde se registran los comandos                             | —                        |
| `ASSETS_DIR`           | Carpeta con el arte: cosméticos y catálogo (ver [El arte](#el-arte)) | `assets`                 |
| `DATABASE_URL`         | Archivo SQLite                                                       | `file:./data/duckbot.db` |
| `DEFAULT_LOCALE`       | Idioma si Discord no informa uno (`es-419` o `en-US`)                | `es-419`                 |
| `TIMEZONE`             | Zona horaria: a medianoche se reinician las carreras y el `/diario`  | `America/Mexico_City`    |
| `LEVEL_UP_CHANNEL`     | Canal donde se anuncian las subidas de nivel                         | `duckbot`                |
| `ADOPTER_ROLE`         | Rol de quien tiene pato                                              | `Adoptador de patos`     |
| `LOG_LEVEL`            | `debug`, `info`, `warn` o `error`                                    | `info`                   |

Después, en este orden, genera el cliente de la base de datos, crea la base, registra los comandos y arranca el bot:

```bash
pnpm db:generate
pnpm db:migrate
pnpm commands:deploy
pnpm dev
```

Cuando veas `Logged in as TuBot#1234`, el bot está en línea. Los comandos se registran solo en tu servidor, así que
aparecen al instante. Vuelve a ejecutar `pnpm commands:deploy` cada vez que cambien los comandos.

> El bot solo responde mientras el proceso esté corriendo. Para tenerlo 24/7 hace falta un servidor.

## El arte

El arte no está en el código: el bot lo lee de la carpeta que indica `ASSETS_DIR`, que puede estar fuera del
repositorio. Por defecto es `assets/`, que solo trae un ejemplo mínimo para que el bot funcione y para ver el formato.

```
<ASSETS_DIR>/
├── accessories.json      Los cosméticos
└── catalog/
    └── *.duck.json       Los patos del catálogo
```

- **`accessories.json`:** una lista de cosméticos. Cada uno tiene un `id`, su nombre en `en-US` y `es-419`, el color
  principal, y 4 caras (derecha, frente, izquierda, espalda) con dos capas de 16×16 caracteres (`under` va detrás del
  pato, `over` encima). El ejemplo, con 8 gorras (la blanca y una de cada color del arcoíris), está en
  [`assets/accessories.json`](assets/accessories.json) y se regenera con `pnpm assets:sample`. Al arrancar, el bot
  valida el archivo y pone a la venta los cosméticos nuevos. Si falta o no es válido, el bot arranca sin cosméticos y
  lo avisa en el log.
- **`catalog/*.duck.json`:** proyectos exportados de duck-editor; se usa la versión 8×8 de cada pato. Para añadir
  patos, copia el archivo a esa carpeta y reinicia el bot. `pnpm catalog:birds` genera en esa carpeta
  `aves-mexico.duck.json` (145 aves de México).

Para usar tu propio arte sin subirlo al repositorio, ponlo en otra carpeta y apunta a ella en `.env`:

```bash
ASSETS_DIR=D:/mi-arte
```

## Desarrollo

| Comando                     | Qué hace                                                                   |
| --------------------------- | -------------------------------------------------------------------------- |
| `pnpm dev`                  | Arranca el bot y lo reinicia al guardar.                                   |
| `pnpm start`                | Arranca el bot sin reinicio automático.                                    |
| `pnpm commands:deploy`      | Registra los slash commands en tu servidor.                                |
| `pnpm db:generate`          | Genera el cliente de Prisma (después de instalar o de cambiar el esquema). |
| `pnpm db:migrate`           | Aplica las migraciones (y crea una nueva si cambiaste `schema.prisma`).    |
| `pnpm db:studio`            | Abre Prisma Studio para ver la base de datos.                              |
| `pnpm test`                 | Tests (Vitest).                                                            |
| `pnpm typecheck`            | Comprueba los tipos de todos los paquetes.                                 |
| `pnpm lint` / `pnpm format` | ESLint + Prettier.                                                         |

**Stack:**

- TypeScript sobre Node.js, en un monorepo con pnpm.
- discord.js 14.
- Prisma 7 con SQLite (better-sqlite3).
- Zod para validar la configuración y los datos.
- Vitest, ESLint y Prettier.
- Las imágenes (PNG y GIF) se generan en TypeScript puro, sin dependencias nativas.

```
apps/bot/          Proceso de Discord: comandos, botones, XP por mensajes y tareas automáticas
packages/core/     Reglas del juego puras (sin Discord ni base de datos): patos, niveles, carreras, economía
packages/render/   PNG y GIF de los patos, la galería y las carreras
packages/i18n/     Textos en en-US y es-419
packages/db/       Esquema de Prisma, migraciones y cliente SQLite
assets/            Arte de ejemplo: accessories.json (8 gorras) y catalog/ (3 patos); imágenes del README en media/
```

## Problemas comunes

| Síntoma                                | Solución                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Invalid configuration in .env`        | Falta un valor en `.env` o está mal. El mensaje dice cuál.                                     |
| Error al importar `generated/prisma`   | Ejecuta `pnpm db:generate`.                                                                    |
| Los comandos no aparecen               | Ejecuta `pnpm commands:deploy`, revisa `DISCORD_DEV_GUILD_ID` y recarga Discord (`Ctrl + R`).  |
| `Missing Access` al registrar comandos | El bot no está en ese servidor o se invitó sin el scope `applications.commands`.               |
| `TokenInvalid` al arrancar             | El token está mal copiado o se regeneró. Copia uno nuevo.                                      |
| El bot no da el rol de adoptador       | Dale **Gestionar roles** y pon su rol por encima de **Adoptador de patos** en Ajustes → Roles. |
| "La aplicación no respondió"           | El bot no está corriendo o se cayó: revisa la terminal.                                        |
