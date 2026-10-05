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

## Clave por persona

La primera vez que alguien entra a su nombre, la app le pide crear una
clave (dos veces, para confirmar). Las próximas veces en ese mismo
dispositivo no la vuelve a pedir ("Cambiar" en el menú sí te manda de
nuevo a elegir nombre y clave). La clave se guarda con hash (no en texto
plano) en la base de datos, no en el código — así, para entrar como la
otra persona en OTRO dispositivo hace falta su clave real, no algo
visible en el código fuente. Cada quien puede cambiar su propia clave
desde **Perfil → Cambiar mi clave** (pide la clave actual).

Si alguien olvida su clave, en la pantalla donde la pide hay un link
**"¿Olvidaste tu clave?"** que la borra y manda directo a crear una
nueva (como la primera vez). No pide verificación de identidad — es
la misma idea de siempre: una barrera para no entrar sin querer o por
curiosidad, no un sistema de autenticación con recuperación real
(sin eso, cualquiera que sepa el nombre podría resetear la clave de
cualquiera). Si prefieren, también se puede borrar manualmente la fila
`auth:<nombre>` en la base de datos desde el dashboard de Upstash.

## Notificaciones

La app puede avisar por notificación push del celular/navegador cuando el
otro crea un plan o vota (botón **🔔 Activar avisos** en el menú de
arriba). Para que funcione hace falta configurar 3 variables de entorno
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
