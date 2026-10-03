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

En [config.js](config.js), `PERSON_PASSWORDS` tiene una clave opcional por
persona (mismo orden que `PEOPLE`). Déjala en `""` para que esa persona
entre sin clave, o ponle un valor para que la pida antes de entrar.
Ojo: es una barrera liviana (el valor va en el código del navegador), no
seguridad real — alcanza para que el otro no entre por error o curiosidad,
no para proteger datos sensibles.
