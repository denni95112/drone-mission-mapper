# Performance Optimizations - Setup Guide

## Quick Setup Checklist

After implementing the performance optimizations, ensure the following:

### 1. Directory Permissions ✅

Create and set permissions for the temporary export directory:

```bash
mkdir -p tmp/exports
chmod 755 tmp/exports
```

Or on Windows:
- Create folder: `tmp/exports`
- Ensure PHP has write permissions

### 2. Apache Configuration ✅

The `.htaccess` file requires:
- `mod_deflate` (for Gzip compression)
- `mod_expires` (for cache headers)
- `mod_headers` (for Cache-Control headers)

**Check if modules are enabled:**
```bash
apache2ctl -M | grep -E "deflate|expires|headers"
```

**Enable if needed:**
```bash
sudo a2enmod deflate
sudo a2enmod expires
sudo a2enmod headers
sudo systemctl restart apache2
```

### 3. Nginx Configuration (Alternative)

If using Nginx instead of Apache, add to your server block:

```nginx
# Gzip compression
gzip on;
gzip_types text/html text/plain text/css text/javascript application/javascript application/json;

# Cache static assets
location ~* \.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff|woff2|ttf|otf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Don't cache PHP files
location ~ \.php$ {
    add_header Cache-Control "no-cache, must-revalidate";
}
```

### 4. Verify Database Indexes ✅

The indexes will be created automatically on next database access. To verify:

```sql
-- Check indexes
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';
```

You should see the new composite indexes:
- `idx_missions_created_at_status`
- `idx_drone_positions_mission_recorded`
- `idx_map_icons_mission_type`
- `idx_map_icon_positions_mission_recorded`

### 5. Test Cache Functionality ✅

1. **Test Config Cache:**
   - Load a page multiple times
   - Check that config file is only read once per file change

2. **Test Mission Cache:**
   - Load same mission multiple times
   - First load: database query
   - Subsequent loads: from cache (faster)

3. **Test API Cache:**
   - Call `/api/drones.php` multiple times
   - First call: generates data
   - Subsequent calls (within 3 seconds): from cache

4. **Test Client Cache:**
   - Open browser DevTools → Network tab
   - Load page multiple times
   - Verify API calls are cached (check response times)

### 6. Monitor Performance ✅

Use browser DevTools to verify:

1. **Network Tab:**
   - Static assets should show "from cache" or "from disk cache"
   - Responses should be compressed (check Content-Encoding: gzip)

2. **Performance Tab:**
   - Measure page load time
   - Should see improvement in load times

3. **Application Tab:**
   - Check cache storage (if using browser cache)

### 7. Verify Compression ✅

Check if Gzip is working:

```bash
curl -H "Accept-Encoding: gzip" -I http://your-domain.com/css/styles.css
```

Should see: `Content-Encoding: gzip`

### 8. Common Issues & Solutions

#### Issue: Cache not working
**Solution:** 
- Check that `includes/cache.php` is loaded
- Verify cache classes are being used
- Check PHP error logs

#### Issue: Static assets not caching
**Solution:**
- Verify `.htaccess` is being read (check Apache error logs)
- Ensure mod_expires is enabled
- Check file permissions

#### Issue: Compression not working
**Solution:**
- Verify mod_deflate is enabled
- Check `.htaccess` syntax
- Test with curl command above

#### Issue: Export files not created
**Solution:**
- Check `tmp/exports/` directory exists
- Verify write permissions
- Check PHP error logs

### 9. Performance Benchmarks

Before implementing, measure:
- Page load time: _____ seconds
- API response time: _____ ms
- Database query time: _____ ms

After implementing, measure again and compare.

### 10. Rollback Plan

If issues occur, you can temporarily disable:

1. **Disable caching:**
   - Comment out cache includes
   - Use original `include` for config

2. **Disable compression:**
   - Rename `.htaccess` to `.htaccess.bak`

3. **Disable file storage:**
   - Revert export_positions.php to use session

---

## Verification Commands

```bash
# Check Apache modules
apache2ctl -M | grep -E "deflate|expires|headers"

# Test Gzip compression
curl -H "Accept-Encoding: gzip" -I http://localhost/css/styles.css

# Check directory permissions
ls -la tmp/exports

# Check PHP error logs
tail -f /var/log/apache2/error.log
```

---

## Support

If you encounter issues:
1. Check PHP error logs
2. Check Apache/Nginx error logs
3. Verify all files are in place
4. Test with browser DevTools
5. Review `IMPLEMENTATION_SUMMARY.md` for details

---

**Last Updated:** 2025-01-18
