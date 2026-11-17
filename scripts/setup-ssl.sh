#!/bin/bash

# Setup SSL certificates for foodstream.live using Let's Encrypt
# Run this script ONCE on your VM before starting nginx

DOMAIN="foodstream.live"
EMAIL="arthaud.poupard@epitech.eu"  # Change this to your email

echo "🔐 Setting up SSL certificates for $DOMAIN"

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    sudo apt update && sudo apt install -y certbot python3-certbot-nginx
fi

# Stop nginx to free port 80
echo "⏹️  Stopping nginx/services to free port 80..."
if sudo systemctl is-active --quiet nginx; then
    sudo systemctl stop nginx
    NGINX_WAS_RUNNING=true
elif command -v docker &> /dev/null && sudo docker ps --format '{{.Names}}' | grep -Eq '^(nginx|nginx-https)$'; then
    NGINX_CONTAINER=$(sudo docker ps --format '{{.Names}}' | grep -E '^(nginx|nginx-https)$' | head -n 1)
    sudo docker stop "$NGINX_CONTAINER"
    DOCKER_WAS_RUNNING=true
fi

sleep 2

# Build domain list (always include root domain; include www / analytics if they resolve in DNS)
CERT_DOMAINS=(-d "$DOMAIN")
for SUB in "www.$DOMAIN" "analytics.$DOMAIN"; do
    if getent ahosts "$SUB" &> /dev/null; then
        CERT_DOMAINS+=(-d "$SUB")
    else
        echo "⚠️  $SUB does not resolve in DNS yet — skipping it in certificate request"
    fi
done

# Generate certificate
echo "🔄 Generating Let's Encrypt certificate for: ${CERT_DOMAINS[*]}..."
sudo certbot certonly --standalone \
    --cert-name "$DOMAIN" \
    "${CERT_DOMAINS[@]}" \
    -m "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --expand
CERTBOT_STATUS=$?

# Restart nginx/services
if [ "$NGINX_WAS_RUNNING" = true ]; then
    echo "▶️  Restarting nginx..."
    sudo systemctl start nginx
elif [ "$DOCKER_WAS_RUNNING" = true ]; then
    echo "▶️  Restarting Docker $NGINX_CONTAINER..."
    sudo docker start "$NGINX_CONTAINER"
fi

if [ $CERTBOT_STATUS -eq 0 ]; then
    echo "✅ Certificate generated successfully!"
    echo "📍 Certificate path: /etc/letsencrypt/live/$DOMAIN/"
    echo ""
    echo "📝 Next steps:"
    echo "1. Verify deploy/nginx.conf has the correct certificate paths"
    echo "2. Start or reload Docker stack: docker compose --project-directory . -f deploy/docker-compose.vm.yml up -d --build"
    echo "3. Setup auto-renewal: sudo systemctl enable certbot.timer"
else
    echo "❌ Certificate generation failed"
    exit 1
fi

# Setup auto-renewal
echo "🔄 Setting up auto-renewal..."
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

echo "✅ SSL setup complete!"
echo ""
echo "🚀 To reload nginx container:"
echo "   sudo docker restart nginx-https"
echo ""
echo "✅ To verify SSL:"
echo "   sudo certbot certificates"
