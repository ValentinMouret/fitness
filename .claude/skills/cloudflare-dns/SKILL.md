# Cloudflare DNS Management Skill

This skill provides instructions and templates for managing DNS records via Cloudflare for this project.

## Overview
Cloudflare is used as the primary DNS provider for this infrastructure. All DNS-related changes (A, CNAME, TXT records) should be managed through the Cloudflare Dashboard or via the Cloudflare API if appropriate credentials are provided in the environment.

## Operational Instructions

### 1. Checking DNS Records
Before making any changes, always verify the current state of a record using `dig` or `nslookup`.

**Example: Check A record for a subdomain**
```bash
dig @1.1.1.1 api.yourdomain.com A
```

### 
### 2. Creating/Updating Records (Template)
If you have access to the Cloudflare SDK, use it to manage your records. 
*Note: Replace `ZONE_ID` and `RECORD_ID` with actual values from your environment.*

**Example: Update an A record using SDK**
```typescript
// Example logic for updating a record via Cloudflare SDK
await cloudflare.dnsRecords.edit('RECORD_ID', {
  zoneId: 'ZONE_ID',
  type: 'A',
  name: 'api.yourdomain.com',
  content: '1.2.3.4',
  ttl: 3600,
  proxied: true,
});
```

### 3. Verification of Changes
After performing an update, wait for propagation and verify using:
1. `dig` command as shown in step 1.
2. Check Cloudflare dashboard (if accessible).

## Guidelines for Agents
- **Do not** attempt to modify DNS records unless explicitly requested by the user.
- **Always** verify existing records before proposing a change to avoid overwriting critical entries.
- **Prefer** informational checks (reading/digging) over operational changes (writing/SDK) unless tasked with configuration updates.
- If you encounter errors during record verification, report the specific `dig` output to the user.
