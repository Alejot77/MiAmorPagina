# ¿Qué comemos? 🍽️

App para votar qué comer el fin de semana, entre Stefanny y Alejandro. Un voto por persona, y se guarda el historial de todos los findes anteriores.

## Cómo funciona

- Al entrar por primera vez en un dispositivo, cada quien toca su nombre. El celular lo recuerda para la próxima vez ("Cambiar" en la barra de arriba reinicia eso).
- Cualquiera de los dos puede crear la encuesta del finde con las opciones de comida.
- Cada persona puede votar (y cambiar su voto) por una sola opción. El voto anterior se reemplaza, nunca se acumulan dos votos de la misma persona.
- Al crear una encuesta nueva, la anterior queda guardada automáticamente en "Historial".

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
