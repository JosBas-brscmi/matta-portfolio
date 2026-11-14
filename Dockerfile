# --- Stage 1: Build Frontend (Vite) ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build || true

# --- Stage 2: PHP-FPM + Nginx Runtime ---
FROM php:8.2-fpm-alpine
RUN apk add --no-cache nginx postgresql-dev && \
    docker-php-ext-install pdo pdo_pgsql pgsql && \
    echo "clear_env = no" >> /usr/local/etc/php-fpm.d/www.conf

WORKDIR /var/www/html

# Copy frontend static build
COPY --from=builder /app/dist /var/www/html

# Copy backend PHP code and dependencies
COPY api /var/www/html/api
COPY index.php /var/www/html/
COPY composer*.json /var/www/html/
COPY vendor /var/www/html/vendor
COPY storage /var/www/html/storage

# Copy Nginx configuration
COPY nginx-default.conf /etc/nginx/http.d/default.conf

EXPOSE 80

# Start PHP-FPM in background and Nginx in foreground
CMD php-fpm -D && nginx -g "daemon off;"
