#!/bin/bash
# First installation on the VPS (Ubuntu, Apache, PHP 8.3-FPM, Composer, certbot).
#
# Expects:
#   /tmp/turadioonline.tgz       the code packed by release.ps1 -Install
#   /opt/turadioonline/.env       production environment, created by hand from .env.example
#                                 (Supabase, Wasabi, Culqi, Google, Reverb and mail credentials live only there)
#
# Sets up PHP-FPM, Apache for both hosts with HTTPS, the queue worker, Reverb and the scheduler.
# Everyday code changes go through release.ps1 (release.sh), which never touches data.
set -euo pipefail

APP_DIR=/opt/turadioonline
ARCHIVE=/tmp/turadioonline.tgz
PUBLIC_HOST=turadioonline.miacademiapreu.com
CONTROL_HOST=control-turadioonline.miacademiapreu.com
ADMIN_EMAIL=${CERTBOT_EMAIL:-admin@miacademiapreu.com}

if [[ ! -f "${APP_DIR}/.env" ]]; then
  echo "Falta ${APP_DIR}/.env. Créalo a partir de .env.example con las credenciales de producción." >&2
  exit 1
fi

echo "==> Extracting code"
tar -xzf "${ARCHIVE}" --no-same-owner -C "${APP_DIR}"
cd "${APP_DIR}"
mkdir -p storage/framework/{cache/data,sessions,views} storage/logs storage/app/public bootstrap/cache

echo "==> Composer install"
export COMPOSER_ALLOW_SUPERUSER=1
composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

grep -q '^APP_KEY=base64:' .env || php artisan key:generate --force

echo "==> Database"
# Supabase: the platform lives in its own schema (DB_SEARCH_PATH), out of the Data API.
php artisan tinker --execute="if (DB::getDriverName() === 'pgsql') { DB::statement('create schema if not exists '.DB::getConfig('search_path')); }"
php artisan migrate --force
USERS=$(php artisan tinker --execute="try { echo 'ROWS='.(int) DB::table('users')->count(); } catch (Throwable \$e) { echo 'ROWS=-1'; }" 2>/dev/null | grep -o 'ROWS=-\?[0-9]*' | tail -1 | cut -d= -f2 || true)
if [[ "${USERS:--1}" == "0" ]]; then
  php artisan db:seed --force
else
  echo "    users already exist (${USERS:-?}); seed skipped"
fi
php artisan storage:link --force || true
php artisan optimize

chown -R www-data:www-data storage bootstrap/cache
find storage bootstrap/cache -type d -exec chmod 775 {} \;

echo "==> PHP-FPM pool"
cat > /etc/php/8.3/fpm/pool.d/turadioonline.conf <<'POOL'
[turadioonline]
user = www-data
group = www-data
listen = /run/php/php8.3-fpm-turadioonline.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = dynamic
pm.max_children = 10
pm.start_servers = 3
pm.min_spare_servers = 2
pm.max_spare_servers = 6
php_admin_value[upload_max_filesize] = 200M
php_admin_value[post_max_size] = 200M
php_admin_value[memory_limit] = 256M
php_admin_value[max_execution_time] = 120
POOL

echo "==> Background services"
cat > /etc/systemd/system/turadioonline-queue.service <<UNIT
[Unit]
Description=Tu Radio Online queue worker
After=network.target

[Service]
User=www-data
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/php artisan queue:work --sleep=2 --tries=3 --max-time=3600
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/turadioonline-media.service <<UNIT
[Unit]
Description=Tu Radio Online audio renders (ffmpeg)
After=network.target

[Service]
User=www-data
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/php artisan queue:work media --queue=media --timeout=10800 --tries=1 --sleep=3
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/turadioonline-reverb.service <<UNIT
[Unit]
Description=Tu Radio Online realtime server (Reverb)
After=network.target

[Service]
User=www-data
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/php artisan reverb:start --host=127.0.0.1 --port=8080
Restart=always
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

echo "* * * * * www-data cd ${APP_DIR} && php artisan schedule:run >> /dev/null 2>&1" > /etc/cron.d/turadioonline

systemctl daemon-reload
systemctl enable --now turadioonline-queue turadioonline-media turadioonline-reverb

echo "==> Apache"
a2enmod proxy proxy_fcgi proxy_http proxy_wstunnel rewrite headers setenvif ssl >/dev/null
cp -f deploy/apache/turadioonline-storage.conf /etc/apache2/conf-available/
a2enconf turadioonline-storage >/dev/null

cat > /etc/apache2/sites-available/turadioonline.conf <<APACHE
<VirtualHost *:80>
  ServerName ${PUBLIC_HOST}
  ServerAlias ${CONTROL_HOST}

  Alias /.well-known/acme-challenge/ /var/www/letsencrypt/.well-known/acme-challenge/
  <Directory /var/www/letsencrypt/.well-known/acme-challenge/>
    Require all granted
  </Directory>

  RewriteEngine on
  RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
  RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,NE,R=permanent]
</VirtualHost>
APACHE
mkdir -p /var/www/letsencrypt
a2ensite turadioonline >/dev/null
systemctl reload apache2

if [[ ! -f /etc/letsencrypt/live/${PUBLIC_HOST}/fullchain.pem ]]; then
  certbot certonly --webroot -w /var/www/letsencrypt -d "${PUBLIC_HOST}" -d "${CONTROL_HOST}" \
    --non-interactive --agree-tos -m "${ADMIN_EMAIL}"
fi

cat > /etc/apache2/sites-available/turadioonline-le-ssl.conf <<APACHE
<IfModule mod_ssl.c>
<VirtualHost *:443>
  ServerName ${PUBLIC_HOST}
  ServerAlias ${CONTROL_HOST}
  DocumentRoot ${APP_DIR}/public

  <Directory ${APP_DIR}/public>
    Options FollowSymLinks
    AllowOverride All
    Require all granted
    DirectoryIndex index.php
  </Directory>

  <FilesMatch \.php$>
    SetHandler "proxy:unix:/run/php/php8.3-fpm-turadioonline.sock|fcgi://localhost"
  </FilesMatch>

  # Realtime (Reverb) websockets and its HTTP API
  ProxyPreserveHost On
  RewriteEngine on
  RewriteCond %{HTTP:Upgrade} websocket [NC]
  RewriteCond %{HTTP:Connection} upgrade [NC]
  RewriteRule ^/app/(.*) ws://127.0.0.1:8080/app/\$1 [P,L]
  ProxyPass /apps http://127.0.0.1:8080/apps
  ProxyPassReverse /apps http://127.0.0.1:8080/apps

  RequestHeader set X-Forwarded-Proto "https"
  RequestHeader set X-Forwarded-Port "443"
  Header always set Strict-Transport-Security "max-age=31536000"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"

  ErrorLog \${APACHE_LOG_DIR}/turadioonline-error.log
  CustomLog \${APACHE_LOG_DIR}/turadioonline-access.log combined

  Include /etc/letsencrypt/options-ssl-apache.conf
  SSLCertificateFile /etc/letsencrypt/live/${PUBLIC_HOST}/fullchain.pem
  SSLCertificateKeyFile /etc/letsencrypt/live/${PUBLIC_HOST}/privkey.pem
</VirtualHost>
</IfModule>
APACHE
a2ensite turadioonline-le-ssl >/dev/null

systemctl restart php8.3-fpm
apache2ctl configtest
systemctl reload apache2

echo "==> Health checks"
sleep 1
for host in "${PUBLIC_HOST}" "${CONTROL_HOST}"; do
  curl -s -o /dev/null -w "${host}/up %{http_code}\n" --resolve "${host}:443:127.0.0.1" "https://${host}/up" -k
done

echo "INSTALL OK"
