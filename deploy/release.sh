#!/bin/bash
# Applies a code-only release (see release.ps1) on the VPS.
# Data stays in place: .env, storage/ and the database are never replaced.
set -euo pipefail

APP=/opt/turadioonline
ARCHIVE=${1:-/root/turadioonline-release.tgz}
PARTS=(app bootstrap/app.php bootstrap/providers.php config database/migrations database/seeders database/factories deploy lang public/build public/favicon.svg public/index.php public/robots.txt public/.htaccess resources/views routes artisan composer.json composer.lock)

cd "$APP"
STAMP=$(date +%Y%m%d-%H%M%S)
EXISTING=()
for part in "${PARTS[@]}"; do [ -e "$part" ] && EXISTING+=("$part"); done
tar -czf "/root/turadioonline-code-before-$STAMP.tgz" "${EXISTING[@]}"
echo "code backup: $STAMP"

php artisan down --retry=15 || true
trap 'php artisan up || true' EXIT

LOCK_BEFORE=$(sha1sum composer.lock | cut -d' ' -f1)
# Each part is swapped whole so files deleted from the repository also disappear from the server.
STAGE=$(mktemp -d)
tar -xzf "$ARCHIVE" --no-same-owner -C "$STAGE"
for part in "${PARTS[@]}"; do
  [ -e "$STAGE/$part" ] || continue
  rm -rf "${APP:?}/$part"
  mkdir -p "$(dirname "$APP/$part")"
  mv "$STAGE/$part" "$APP/$part"
done
rm -rf "$STAGE"

if [ "$LOCK_BEFORE" != "$(sha1sum composer.lock | cut -d' ' -f1)" ]; then
  echo "PHP dependencies changed: composer install"
  COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader --no-interaction --no-progress
fi

php artisan optimize:clear >/dev/null
php artisan migrate --force
# Roles follow their enums: new permissions reach existing roles on every release.
php artisan db:seed --class=AccessSeeder --force
# The super administrator gets its control panel username from SUPERADMIN_* in .env.
php artisan db:seed --class=SuperAdminSeeder --force
php artisan optimize >/dev/null
chown -R www-data:www-data storage bootstrap/cache public/build
install -m 644 deploy/php-fpm.conf /etc/php/8.3/fpm/pool.d/turadioonline.conf
php-fpm8.3 -t
# Graceful: the other sites served by this PHP-FPM finish their requests.
systemctl reload php8.3-fpm
sudo -u www-data php artisan queue:restart >/dev/null
sudo -u www-data php artisan reverb:restart >/dev/null || true
php artisan up

# Every PHP worker opens its database connection now instead of on a visitor's request.
HOST=$(sed -n 's/^PUBLIC_HOST=//p' .env | tr -d '"')
WORKERS=$(sed -n 's/^pm.max_children = //p' deploy/php-fpm.conf)
for _ in $(seq $((WORKERS * 2))); do
  curl -s -o /dev/null --max-time 20 --resolve "$HOST:443:127.0.0.1" "https://$HOST/up" &
done
wait

echo "RELEASE OK"
