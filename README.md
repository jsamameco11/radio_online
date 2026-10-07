# Tu Radio Online

Plataforma de radios por internet: cada emisora tiene su frecuencia (**89.30 FM · Radio Aurora**), un estudio profesional (consola en vivo, piloto automático, programación, biblioteca, episodios, editor de audio) y recibe regalos de sus oyentes.

- **Sitio público** — `turadioonline.miacademiapreu.com`: explorar, escuchar, seguir, regalar, billetera y "Crear mi radio".
- **Centro de control** — `control-turadioonline.miacademiapreu.com`: panel de la plataforma (`/admin`) y estudios de cada emisora (`/estudio/{frecuencia}`).

## Stack

Laravel 13 · Inertia 3 · React 19 · TypeScript · Tailwind 4 · Fortify (2FA) · spatie/laravel-permission · Reverb · Stripe · Wasabi (S3) · PostgreSQL (Supabase).

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
- Centro de control: <http://control-turadioonline.localhost:8000>

El super administrador se crea con `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` del `.env`. En entorno local se siembran radios de demostración (contraseña `password`).

## Calidad

```sh
php artisan test --compact
vendor/bin/pint --dirty
npx tsc --noEmit
```

Convenciones de arquitectura y código: [AGENTS.md](AGENTS.md).
