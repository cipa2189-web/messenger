#!/bin/bash
set -e

APP_DIR="/var/www/messenger"

apt update
apt install -y nodejs npm ufw
npm install -g pm2

mkdir -p "$APP_DIR/data/chats"
cd "$APP_DIR"

npm install

ufw allow 22/tcp
ufw allow 3000/tcp
ufw --force enable

pm2 delete messenger 2>/dev/null || true
pm2 start server.js --name messenger
pm2 startup
pm2 save
