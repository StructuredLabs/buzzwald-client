# Cache-Busting Deployment Guide

This guide explains how to deploy the cache-busting solution for the Buzzwald widget.

## Overview

The cache-busting solution ensures users always get the latest widget version without changing their embed code. It works by:

1. **Loader Script**: A lightweight script that never changes and can be cached
2. **Version Check**: Fetches current version info from `version.json`
3. **Dynamic Loading**: Loads the actual widget with cache-busting parameters

## New User Embed Code

Users will now use this single script tag that never changes:

```html
<script>
    window.BuzzwaldConfig = {
        id: 'your-assistant-id',
        token: '', // Optional - will be fetched automatically
        backgroundColor: '#FFFF00',
        iconColor: '#000000'
    };
</script>
<script src="https://cdn.jsdelivr.net/gh/StructuredLabs/buzzwald-client@latest/dist/buzzwald.js"></script>
```

## Build Process

### Files Generated

After running `bun run build`, these files are created in `dist/`:

- `buzzwald.js` - The cache-busting loader (users embed this)
- `buzzwald-widget.js` - The actual widget code
- `version.json` - Version information for cache busting

### Version Info Structure

The `version.json` file contains:

```json
{
  "version": "0.0.1",
  "commit": "abc1234",
  "timestamp": 1703123456789,
  "buildDate": "2023-12-21T10:30:45.123Z",
  "buildId": "0.0.1-abc1234-1703123456789",
  "cacheBuster": "v=0.0.1&t=1703123456789"
}
```

## Deployment Steps

### 1. Build the Project

```bash
bun run build:release
```

This creates the `dist/` directory with all necessary files.

### 2. Create GitHub Release

1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Choose a tag version (e.g., `v0.0.2`)
4. Upload the `dist/` folder contents as release assets, OR
5. Let GitHub Actions build and attach the assets automatically

### 3. JSDelivr Automatic Updates

JSDelivr automatically updates `@latest` when you create a new GitHub release:

- `https://cdn.jsdelivr.net/gh/StructuredLabs/buzzwald-client@latest/dist/buzzwald.js`
- `https://cdn.jsdelivr.net/gh/StructuredLabs/buzzwald-client@latest/dist/buzzwald-widget.js`
- `https://cdn.jsdelivr.net/gh/StructuredLabs/buzzwald-client@latest/dist/version.json`

## How Cache Busting Works

### 1. Loader Script (`buzzwald.js`)
- Users embed this script (it never changes)
- Can be cached indefinitely by browsers
- Responsible for loading the actual widget

### 2. Version Check
- Loader fetches `version.json` with cache-busting headers
- Cached locally for 5 minutes to avoid excessive requests
- Contains timestamp and version info

### 3. Widget Loading
- Widget is loaded with URL parameters: `?v=0.0.1&t=1703123456789`
- Browser treats this as a new URL when version/timestamp changes
- Bypasses browser cache when you deploy updates

### 4. Fallback Strategy
- If version check fails, loads widget with current timestamp
- Ensures widget always loads even if version service is down
- Graceful degradation for network issues

## Cache Settings

### Version Cache
- **Duration**: 5 minutes
- **Purpose**: Avoid excessive version checks
- **Storage**: localStorage

### Script Cache
- **Duration**: 1 hour
- **Purpose**: Avoid re-downloading same widget version
- **Storage**: localStorage

## Testing

### Development Testing
```bash
bun run test:cache-busting
```

Opens the cache-busting test page with tools to:
- Simulate version updates
- Clear cache
- Monitor network requests
- Check version info

### Production Testing
After deployment, test with:
1. Load widget on test page
2. Clear browser cache
3. Reload page - should get latest version
4. Check network tab for cache-busting parameters

## Troubleshooting

### Widget Not Loading
1. Check browser console for errors
2. Verify version.json is accessible
3. Check network tab for failed requests
4. Test with cache disabled

### Users Not Getting Updates
1. Confirm GitHub release was created
2. Check JSDelivr cache (may take 1-2 minutes)
3. Verify version.json has updated timestamp
4. Test with different browser/incognito

### Performance Issues
1. Monitor version check frequency
2. Check localStorage usage
3. Optimize version.json size if needed
4. Consider CDN performance

## Migration from Old Embed Code

### Old Code (deprecated)
```html
<script src="https://cdn.jsdelivr.net/gh/StructuredLabs/buzzwald-client@latest/dist/buzzwald-widget.js"></script>
```

### New Code (recommended)
```html
<script src="https://cdn.jsdelivr.net/gh/StructuredLabs/buzzwald-client@latest/dist/buzzwald.js"></script>
```

### Migration Strategy
1. Update documentation with new embed code
2. Send notification to existing users
3. Keep old method working for backward compatibility
4. Monitor usage analytics
5. Eventually deprecate old method

## Monitoring

### Key Metrics to Monitor
- Version check success rate
- Widget load time
- Cache hit/miss ratios
- Error rates by browser
- User update lag time

### Analytics Implementation
Consider adding analytics to track:
- Loader script loads
- Version check requests
- Widget load success/failure
- Cache effectiveness

## Security Considerations

### Version Endpoint Security
- Version.json contains no sensitive information
- Uses HTTPS for all requests
- No user data in version checks

### Content Security Policy
The loader script:
- Doesn't use `eval()` or inline scripts
- Fetches resources from same origin (JSDelivr)
- Compatible with strict CSP policies

## Future Enhancements

### Possible Improvements
1. **Delta Updates**: Only load changed parts of widget
2. **Progressive Loading**: Load core features first, then enhancements
3. **A/B Testing**: Load different widget versions for testing
4. **Rollback Capability**: Quickly revert to previous version
5. **Regional CDN**: Use geo-specific CDN endpoints