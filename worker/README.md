# Music Admin Worker

Cloudflare Worker backend for the `/admin/` music manager. It holds your secrets
(admin password + GitHub token) server-side, resolves song metadata from
Apple Music / QQ Music, and commits albums to `data/music.json`.

## One-time deploy

1. **Install Wrangler & log in** (needs a free Cloudflare account):
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **Create the GitHub token** (fine-grained PAT):
   - GitHub → Settings → Developer settings → Fine-grained tokens → Generate.
   - Repository access: only `ShenChenkai/ShenChenkai.github.io`.
   - Permissions: **Contents → Read and write**.
   - Copy the token (starts with `github_pat_...`).

3. **Set the secrets** (from inside this `worker/` folder):
   ```bash
   cd worker
   wrangler secret put ADMIN_PASSWORD   # type the password you want for /admin/
   wrangler secret put GITHUB_TOKEN     # paste the github_pat_... token
   ```

4. **Deploy**:
   ```bash
   wrangler deploy
   ```
   Wrangler prints a URL like `https://music-admin.<your-subdomain>.workers.dev`.

5. **Tell the admin page about it**: open `/admin/` on your site, paste that
   Worker URL into the "Worker 地址" field and your password, then click 连接.

## Updating the code later

```bash
cd worker
wrangler deploy
```

## Notes

- Secrets never live in this repo — only in Cloudflare.
- The Worker only accepts requests that carry the correct admin password.
- To change the password: `wrangler secret put ADMIN_PASSWORD` again, redeploy not needed.
