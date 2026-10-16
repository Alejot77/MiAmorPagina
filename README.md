# Plan de dos 💜

App para planear los findes en **salas**: con tu pareja, con amigos, con la familia… Cada sala vota qué comen, qué hacen, qué toman y a dónde van, y guarda su historial, sus sitios, sus fotos y su resumen del mes.

## Cómo funciona

- Cada persona tiene su **cuenta** (nombre, correo y clave) y puede estar en varias **salas**.
- Una sala se **crea** desde la app y se **invita** con un código de 6 letras o con el enlace `/unirme/<código>`. Quien abre el enlace sin cuenta la crea ahí mismo y entra a la sala.
- Arriba, al tocar el nombre de la sala, se **cambia de sala**. Las salas **fijadas** (📌) salen primero y, si hay dos o más, aparecen como accesos rápidos debajo del encabezado.
- Un plan tiene una o varias **categorías** (comida —opcionalmente desayuno, almuerzo o cena—, actividad, bebida, entretenimiento, lugar u otra), cada una con sus opciones.
- **Votación**: los votos quedan ocultos hasta que voten todos los de la sala. Gana la opción con más votos; si varias empatan, hay empate (y está la ruleta). En salas de más de 2 personas, quien creó el plan o un admin puede **cerrar la votación** antes si alguien no vota. En pareja se decide cuando votan los dos.
- Votan quienes estaban en la sala cuando se creó el plan: quien entra después vota en los planes nuevos, y quien se va deja de contar.
- Pueden existir **varios planes activos a la vez** (sábado, domingo, festivo…). Cada plan pasa a "Historial" el **martes siguiente a su fecha**.
- **Puntos por sala**: cada categoría que agregas suma puntos; al llegar a la meta ganas el premio de la sala (por defecto «postre»). Hay un ranking por sala.
- **Admins**: quien crea la sala la administra. Puede renombrarla, cambiar el código, cambiar las reglas de puntos, nombrar otros admins y sacar personas. Cualquiera puede salir de una sala; si sale la última persona, la sala se borra con todo lo suyo.

## Desplegar en Vercel

1. Sube esta carpeta a un repositorio de GitHub (puede ser privado).
2. En [vercel.com](https://vercel.com), "Add New Project" → importa ese repositorio. Vercel detecta que es Next.js automáticamente.
3. Antes de o después del primer deploy, ve a la pestaña **Storage** del proyecto en Vercel → **Create Database** → elige **Upstash** (Redis, del marketplace) y conéctala al proyecto. Esto agrega automáticamente las variables de entorno que la app necesita (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
4. Haz (re)deploy del proyecto. Listo, ya pueden entrar los dos al link que les da Vercel.

## Desarrollo local (opcional)

Si más adelante instalas Node.js en esta máquina:

```bash
npm install
vercel env pull .env.local   # trae las credenciales de Upstash desde Vercel
npm run dev
```

## Cuentas (correo + clave)

Cualquiera puede **crear su cuenta** con nombre, correo y clave (6 o más caracteres). Le llega un correo para confirmar ese correo (vence en 24 horas); mientras no lo confirme, la app muestra un aviso para reenviarlo. Un correo sin confirmar por más de 24 horas se libera para que nadie "aparte" el correo de otra persona.

La clave se guarda con hash (scrypt), nunca en texto plano. El correo verificado es el único que sirve para recuperar la clave:

- **¿Olvidaste tu clave?** manda un enlace a ese correo para crear una clave nueva (1 hora, un solo uso). La respuesta es la misma exista o no la cuenta.
- **Cuenta → Mi correo** lo cambia (pide la clave); el anterior sigue sirviendo hasta que se confirme el nuevo.
- **Cuenta → Mi clave** cambia la clave y cierra la sesión en los otros celulares.

### Paso a salas (migración automática)

La primera vez que alguien abre esta versión, la app pasa sola los datos de antes (Stefanny y Alejandro) a una cuenta por persona —con su misma clave, correo, tema y avisos— y a la sala de pareja con todos sus planes, votos, fotos, sitios y puntos. Las sesiones abiertas siguen funcionando. Los datos viejos no se borran: quedan como respaldo (`plan:*`, `votes:*`, `auth:*`…).

### Datos en Upstash

- `user:<id>`, `user-email:<correo>` → cuenta; `user-groups:<id>` → sus salas.
- `group:<id>` (nombre, admins, código, reglas), `members:<id>`, `invite:<código>`, `groups`.
- Todo lo de una sala va bajo `g:<sala>:…` (`plans`, `plan:<id>`, `votes:<plan>:<paso>`, `places`, `place:<id>`, `photos:<plan>`, `points:<cuenta>`), así una sala nunca toca los datos de otra.

### Sesiones y seguridad

- Al entrar con la clave, el servidor crea una **sesión**: un token al
  azar en una cookie `httpOnly` (el JavaScript de la página no la puede
  leer) con `SameSite=Lax`. En la base solo se guarda su hash
  (`session:<hash>`), y vence a los 180 días sin usar la app.
- **Todas** las rutas de la API toman la cuenta de la sesión, nunca de
  lo que mande el navegador. Las de una sala reciben la sala en el
  encabezado `X-Group` y verifican que la cuenta sea miembro. Sin sesión responden 401 (salvo la pantalla
  de entrada, "olvidé mi clave", los enlaces de los correos y el cron).
  Las que cambian datos rechazan peticiones de otros sitios (`Origin`).
- 8 claves equivocadas seguidas bloquean esa cuenta 15 minutos.
- Cambiar o recuperar la clave cierra las sesiones de los otros
  celulares. "Cambiar de persona" cierra la sesión también en el servidor.
- Los enlaces de los correos usan siempre el dominio de producción de
  Vercel (`VERCEL_PROJECT_PRODUCTION_URL`, o `APP_URL` si se define), no
  el que diga la petición.
- Lo que se guarda se limpia antes: textos con largo máximo, solo enlaces
  `http`/`https`, fechas y categorías válidas, y avisos solo hacia los
  servicios de notificaciones reales (Google, Apple, Mozilla, Microsoft).
- La app manda encabezados de seguridad (no se puede meter en un iframe,
  `nosniff`, HSTS, etc.).

### Envío de correos (Gmail)

Los correos salen de una cuenta de Gmail con una *contraseña de
aplicación*:

1. En la cuenta de Google que va a enviar (puede ser una nueva solo para
   la app), activa la **verificación en 2 pasos**.
2. Entra a <https://myaccount.google.com/apppasswords>, crea una con
   nombre "Plan de dos" y copia las 16 letras.
3. En Vercel → Settings → Environment Variables agrega:
   - `GMAIL_USER` → la dirección de Gmail que envía.
   - `GMAIL_APP_PASSWORD` → las 16 letras (márcala como **Sensitive**).
4. Vuelve a desplegar para que tome las variables.

Opcional: `APP_URL` (ej. `https://tu-app.vercel.app`) fija el dominio
de los enlaces de los correos; si no está, se usa el dominio desde donde
se abrió la app. Para usar otro proveedor por SMTP en vez de Gmail:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM`.

## Fotos y resumen del mes

Cada día que ya pasó tiene sus **fotos** (botón de cámara en el inicio, o
"Fotos del día" en el menú ⋯ del día, o dentro del recuerdo en
Historial). Se comprimen en el celular antes de subir (lado mayor
1600 px, JPEG) y se guardan en **Vercel Blob** con una URL que no se
puede adivinar. Hasta 40 fotos por plan; al borrar un plan se borran sus
fotos.

El **resumen del mes** (historias tipo Wrapped: salidas, dónde comieron,
qué hicieron, qué tomaron, el recuerdo favorito, el photodump y datos
curiosos) se abre el día 1 del mes siguiente (hora de Bogotá). Aparece
en Historial y, mientras no lo abran, como aviso en el inicio. Un cron
de Vercel (`vercel.json`, día 1 a las 9:00 a. m. de Bogotá) les manda la
notificación "Su resumen de … está listo".

Configuración (una sola vez):

1. Vercel → **Storage** → **Create Database** → **Blob** → conéctalo al
   proyecto. Eso agrega `BLOB_READ_WRITE_TOKEN` solo.
2. Vercel → Settings → Environment Variables → `CRON_SECRET` con un texto
   largo al azar (marcado como Sensitive). Vercel lo manda al llamar el
   cron; sin él, el aviso del día 1 no sale (el resumen igual funciona).

## Temas de color

Cada persona elige su tema en **Cuenta → Tema** (Lila, Rosa, Océano,
Lila noche, Rojo noche, Azul noche). Solo cambia cómo lo ve esa persona,
se guarda en la cuenta (`user:<id>`) para que la siga en otros
celulares y en el dispositivo para que abra sin parpadeo. Por defecto: Lila. Los temas están en `THEMES`
(config.js) y sus colores en `app/redesign.css` (`[data-theme=...]`).

## Notificaciones

La app puede avisar por notificación push del celular/navegador cuando el
otro crea o edita un plan, o vota (se activan desde la ventana que aparece al
entrar, o desde **Cuenta → Avisos**). Para que funcione hace falta configurar 3 variables de entorno
en Vercel (**Settings → Environment Variables**):

1. Genera un par de claves VAPID (una sola vez, se reutilizan siempre):
   ```bash
   node -e "console.log(require('web-push').generateVAPIDKeys())"
   ```
2. En Vercel agrega:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` → el `publicKey` que te dio el comando.
   - `VAPID_PRIVATE_KEY` → el `privateKey` (este sí es secreto, no lo compartas).
   - `VAPID_SUBJECT` → `mailto:tu-correo@ejemplo.com` (un contacto, lo exige el estándar).
3. Redeploy. En Vercel, estas variables solo se "hornean" en el código la
   próxima vez que se construye el proyecto, así que un simple redeploy
   basta (no hace falta tocar código).

Si no configuras estas variables, la app funciona igual pero el botón de
notificaciones no aparece (se oculta solo si no hay clave pública).

Notas:
- Al entrar, la app pregunta **"¿Activar los avisos?"** (si se responde
  "Ahora no", vuelve a preguntar en 7 días). Al tocar "Sí, activar" sale la
  solicitud de permiso del celular/navegador. Si el navegador no la muestra
  o quedó bloqueada, la app explica dónde activarlas a mano.
- La app es instalable (PWA): tiene manifest (`app/manifest.js`) e íconos
  (`public/icon-*.png`, `public/apple-touch-icon.png`). En Android, Chrome
  ofrece "Instalar app"; en iPhone se instala con Compartir → "Agregar a
  inicio".
- **En iPhone es obligatorio instalarla**: Safari solo permite
  notificaciones a apps agregadas a la pantalla de inicio y abiertas desde
  ese ícono (iOS 16.4 o más reciente). Si se abre en Safari, la app muestra
  esos pasos en vez del botón de activar.
- Las notificaciones solo le llegan a **la otra persona**, no a quien
  hizo la acción.
- Si se cambian las claves VAPID, cada dispositivo renueva su suscripción
  solo la próxima vez que se abre la app (mientras tanto los avisos a ese
  dispositivo fallan).
- Cada envío queda en los logs de Vercel (**Logs**) con el prefijo
  `[push]`: a quién se mandó, si falló y por qué, o si esa persona no tiene
  dispositivos con avisos activados.
