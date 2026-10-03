# Nuestros planes 💜

App para planear los findes entre Stefanny y Alejandro: qué comen, qué hacen, qué toman, a qué juegan, dónde están... Un voto por persona y categoría, y se guarda el historial de todos los planes anteriores.

## Cómo funciona

- Al entrar por primera vez en un dispositivo, cada quien toca su nombre. El celular lo recuerda para la próxima vez ("Cambiar" en la barra de arriba reinicia eso).
- Un plan tiene una o varias **categorías** (comida, actividad, bebida, juego, lugar, u otra personalizada), cada una con sus propias opciones para votar. Las opciones pueden llevar un link (menú del restaurante, Google Maps, etc).
- Se puede crear un plan con solo una categoría (ej. "solo comida") o con varias de una vez (un día completo). También se puede **agregar una categoría nueva a un plan que ya existe** — por ejemplo, decidir primero la comida y después agregar "qué hacemos".
- Cada persona puede votar (y cambiar su voto) por una sola opción en cada categoría. El resultado (quién votó qué y quién va ganando) queda oculto hasta que **ambos** hayan votado esa categoría; mientras tanto solo se ve si ya votaste o si falta el otro voto.
- El plan activo se puede editar (✏️) o eliminar (🗑️) en cualquier momento. Al crear un plan nuevo, el anterior queda guardado automáticamente en "Historial", donde también se puede eliminar.

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

Ojo: sigue siendo una barrera pensada para esta app entre ustedes dos,
no un sistema de autenticación con todas las de la ley (no hay límite de
intentos ni recuperación de clave olvidada) — si alguna vez olvidan una
clave, se borra borrando la fila `auth:<nombre>` en la base de datos
desde el dashboard de Upstash, y la próxima vez que entren se las vuelve
a pedir crear.

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
- Hay que darle permiso de notificaciones al navegador cuando lo pida.
- En iPhone, Safari solo manda notificaciones push si antes "Agregan a
  pantalla de inicio" la página (Compartir → Agregar a pantalla de
  inicio) y la abren desde ese ícono.
- Las notificaciones solo le llegan a **la otra persona**, no a quien
  hizo la acción.
