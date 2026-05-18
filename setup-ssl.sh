#!/bin/bash

# Setup SSL certificates for foodstream.tv using Let's Encrypt
# Run this script ONCE on your VM before starting nginx

DOMAIN="foodstream.tv"
EMAIL="your-email@example.com"  # Change this to your email

echo "🔐 Setting up SSL certificates for $DOMAIN"

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    sudo apt update && sudo apt install -y certbot python3-certbot-nginx
fi

# Generate certificate
echo "🔄 Generating Let's Encrypt certificate..."
sudo certbot certonly --standalone \
    -d $DOMAIN \
    -d www.$DOMAIN \
    -m $EMAIL \
    --agree-tos \
    --non-interactive

if [ $? -eq 0 ]; then
    echo "✅ Certificate generated successfully!"
    echo "📍 Certificate path: /etc/letsencrypt/live/$DOMAIN/"
    echo ""
    echo "📝 Next steps:"
    echo "1. Verify nginx.conf has the correct certificate paths"
    echo "2. Reload nginx: sudo systemctl reload nginx"
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
echo "🚀 To reload nginx:"
echo "   sudo systemctl reload nginx"
echo ""
echo "✅ To verify SSL:"
echo "   sudo certbot certificates"
