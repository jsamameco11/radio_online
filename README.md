# Tu Radio Online

Plataforma de radios por internet: cada emisora tiene su frecuencia (**89.30 FM · Radio Aurora**), un estudio profesional (consola en vivo, piloto automático, programación, biblioteca, episodios, editor de audio) y recibe regalos de sus oyentes.

- **Sitio público** — `turadioonline.miacademiapreu.com`: explorar, escuchar, suscribirse, chat en vivo con mensajes destacados, regalar, billetera y "Obtén tu frecuencia".
- **Consola de creadores** — `consola-fullradio.miacademiapreu.com`: el estudio de cada emisora (`/{frecuencia}`, por ejemplo `/89-30`) para su equipo.
- **Administración** — `control-turadioonline.miacademiapreu.com`: panel de la plataforma (`/admin`), solo para el staff. Los enlaces antiguos `/estudio/{frecuencia}` redirigen a la consola.

## Stack

Laravel 13 · Inertia 3 · React 19 · TypeScript · Tailwind 4 · Fortify (2FA) · Socialite (Google) · spatie/laravel-permission · Reverb · Culqi · Wasabi (S3) · PostgreSQL (Supabase).

## Desarrollo local

```sh
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
npm run build   # o npm run dev
php artisan serve
```

- Sitio público: <http://turadioonline.localhost:8000>
- Consola de creadores: <http://consola-fullradio.localhost:8000>
- Administración: <http://control-turadioonline.localhost:8000>

El super administrador se crea con `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` del `.env`. En entorno local se siembran radios de demostración (contraseña `password`).

## Calidad

```sh
php artisan test --compact
vendor/bin/pint --dirty
npx tsc --noEmit
```

Convenciones de arquitectura y código: [AGENTS.md](AGENTS.md).
