# Nuestros planes 💜

App para planear los findes entre Stefanny y Alejandro: qué comen, qué hacen, qué toman, a qué juegan, dónde están... Un voto por persona y categoría, y se guarda el historial de todos los planes anteriores.

## Cómo funciona

- Al entrar por primera vez en un dispositivo, cada quien toca su nombre. El celular lo recuerda para la próxima vez ("Cambiar" en la barra de arriba reinicia eso).
- Un plan tiene una o varias **categorías** (comida, actividad, bebida, juego, lugar, u otra personalizada), cada una con sus propias opciones para votar. Las opciones pueden llevar un link (menú del restaurante, Google Maps, etc).
- Se puede crear un plan con solo una categoría (ej. "solo comida") o con varias de una vez (un día completo). También se puede **agregar una categoría nueva a un plan que ya existe** — por ejemplo, decidir primero la comida y después agregar "qué hacemos".
- Cada persona puede votar (y cambiar su voto) por una sola opción en cada categoría. El resultado (quién votó qué y quién va ganando) queda oculto hasta que **ambos** hayan votado esa categoría; mientras tanto solo se ve si ya votaste o si falta el otro voto.
- Pueden existir **varios planes activos a la vez** — por ejemplo uno para el sábado y otro para el domingo (o lunes, si es festivo). Crear uno nuevo no borra ni reemplaza a los demás; cada uno se edita (✏️) y elimina (🗑️) por separado.
- Cada plan pasa solo a "Historial" el **martes siguiente a su fecha** (sin importar cuántos planes nuevos se hayan creado mientras tanto). Hasta entonces se queda visible en la página principal.

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

## Cambiar los nombres

Edita [config.js](config.js) y cambia los valores de `PEOPLE`.

## Cuenta por persona (correo + clave)

La primera vez que alguien entra a su nombre, la app le pide **correo y
clave**. Le llega un correo con un enlace para confirmar ese correo
(vence en 24 horas). Las cuentas de antes del correo lo vinculan la
siguiente vez que entran (o desde **Cuenta → Mi correo**); mientras no
esté confirmado, la app muestra un aviso para reenviar el enlace.

La clave se guarda con hash (scrypt), nunca en texto plano. El correo
verificado es el único que sirve para recuperar la clave:

- **¿Olvidaste tu clave?** (en la pantalla de la clave) manda un enlace a
  ese correo para crear una clave nueva. Vence en 1 hora y sirve una sola
  vez. Sin correo verificado no se puede recuperar por correo: en ese caso
  se borra a mano la fila `auth:<nombre>` en el dashboard de Upstash y
  la persona crea su cuenta otra vez.
- **Cuenta → Mi correo** permite cambiarlo (pide la clave actual). El
  correo nuevo queda pendiente hasta que se confirme; mientras tanto el
  anterior sigue sirviendo para recuperar la clave.
- **Cuenta → Mi clave** cambia la clave (pide la actual).

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
se guarda en la base (`theme:<nombre>`) para que la siga en otros
celulares y en el dispositivo para que abra sin parpadeo. Por defecto:
Stefanny → Lila, Alejandro → Rojo noche. Los temas están en `THEMES`
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
