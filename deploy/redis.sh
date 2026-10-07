#!/bin/bash
# Redis on the VPS for the cache (sessions, account roles), the queue and broadcasts.
# Local only (127.0.0.1), on port 6380: 6379 belongs to another application of the VPS.
# Keys with an expiry (cache, sessions) are evicted first and queued jobs never; an evicted
# session is read back from the database. Safe to run again.
set -euo pipefail

PORT=6380
CONF=/etc/redis/redis.conf

apt-get install -y redis-server php8.3-redis

sed -i "s/^port .*/port ${PORT}/" "$CONF"
grep -q '^maxmemory ' "$CONF" || printf '\nmaxmemory 256mb\n' >> "$CONF"
grep -q '^maxmemory-policy ' "$CONF" || printf 'maxmemory-policy volatile-lru\n' >> "$CONF"

systemctl enable redis-server
systemctl reset-failed redis-server
systemctl restart redis-server
redis-cli -p "$PORT" ping
