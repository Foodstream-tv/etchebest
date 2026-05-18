#!/bin/bash
# Quick setup commands for foodstream.tv with SSL

echo "🚀 Foodstream.tv SSL Setup Commands"
echo "===================================="
echo ""

# Step 1: Make setup script executable
echo "Step 1️⃣  - Making setup script executable..."
echo "   chmod +x setup-ssl.sh"
echo ""

# Step 2: Edit email in setup script
echo "Step 2️⃣  - Edit setup-ssl.sh to add your email:"
echo "   nano setup-ssl.sh"
echo "   # Change: EMAIL=\"your-email@example.com\""
echo ""

# Step 3: Run setup script
echo "Step 3️⃣  - Run SSL setup (requires sudo, port 80 must be free):"
echo "   sudo bash setup-ssl.sh"
echo ""

# Step 4: Verify certificates
echo "Step 4️⃣  - Verify certificates were created:"
echo "   sudo certbot certificates"
echo ""

# Step 5: Reload nginx with new config
echo "Step 5️⃣  - Reload nginx:"
echo "   sudo systemctl reload nginx"
echo "   # OR if using docker:"
echo "   sudo docker exec nginx nginx -s reload"
echo ""

# Step 6: Test SSL
echo "Step 6️⃣  - Test SSL configuration:"
echo "   curl -I https://foodstream.tv"
echo "   curl -I https://www.foodstream.tv"
echo ""

# Step 7: Check certificate renewal
echo "Step 7️⃣  - Check auto-renewal status:"
echo "   sudo certbot renew --dry-run"
echo ""

echo "📋 Files Modified:"
echo "   ✓ nginx.conf - Updated with foodstream.tv domain and security headers"
echo "   ✓ setup-ssl.sh - Script to generate Let's Encrypt certificates"
echo ""

echo "🔒 Security Headers Added:"
echo "   ✓ HSTS (Strict-Transport-Security)"
echo "   ✓ X-Content-Type-Options: nosniff"
echo "   ✓ X-Frame-Options: SAMEORIGIN"
echo "   ✓ X-XSS-Protection"
echo "   ✓ Referrer-Policy"
echo "   ✓ Permissions-Policy"
echo ""

echo "⚠️  IMPORTANT NOTES:"
echo "   1. Make sure DNS points to your VM IP"
echo "   2. Port 80 must be accessible for Let's Encrypt validation"
echo "   3. Port 443 must be accessible for HTTPS"
echo "   4. Edit setup-ssl.sh with your email BEFORE running"
echo ""
