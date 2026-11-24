# ESAP server credentials

**Private. Local only. This folder is in `.gitignore`. Never commit, push, or paste into chat/Discord.**

Last updated: 18 Nov 2026

## Production server (esap-prod-01, netcup)

| | |
|---|---|
| IP | `159.195.83.232` |
| OS hostname | `esap-prod-01` |
| Shared box | ESAP backend on port **8001**; port 8000 is a different app, do not touch |
| API URL | `https://esap-api.159-195-83-232.sslip.io` |
| Website | `https://care.esap.ai` (Vercel, deploys on push to `main`) |

## SSH logins

| User | How to log in | Password | Access |
|---|---|---|---|
| `root` | `ssh netcup` (or `ssh -i C:\Users\ASUS\.ssh\netcup root@159.195.83.232`) | none, key only | Full root |
| `mubasshir` | `ssh mubasshir@159.195.83.232` | *(your own password, set 26 Sep 2026; not stored anywhere readable)* | No sudo; owns `/home/mubasshir/esap-backend` |
| `hamed` (Hamed Hasan) | `ssh hamed@159.195.83.232` | `4OhxdXaFfTzu0i4W` | Login only: no sudo, can read logs (`journalctl -u esap-backend`), cannot read the app, `.env` or database. Created 17 Nov 2026 |
| `sajib` (Sajib) | `ssh sajib@159.195.83.232` | `gnE0TtUW67iK1GQa` | Own login for his own project in `/home/sajib`: no sudo, no system logs, cannot read the ESAP app, `.env` or database. Created 18 Nov 2026 |
| `rahim` | Key only (password SSH is off for this user). Your PC has `C:\Users\ASUS\.ssh\rahim_netcup` | `nSSW43rDYqVg0R` *(as you gave it, not verified; SSH login with a password is off for rahim)* | sudo |
| `nabil` | `ssh nabil@159.195.83.232` | *(unknown)* | No sudo |

Password SSH login is allowed only for the users in `/etc/ssh/sshd_config`:
`Match User nabil,mubasshir,hamed,sajib` → `PasswordAuthentication yes`. Everyone else uses a key.

### Key files on this PC (`C:\Users\ASUS\.ssh\`)

| File | Used for |
|---|---|
| `netcup` / `netcup.pub` | `root@159.195.83.232` (`ssh netcup` shortcut in `~/.ssh/config`) |
| `rahim_netcup` / `.pub` | `rahim@159.195.83.232` |
| `esap_gpu` / `.pub` | GPU box |

The private key files are the credential. Keep them out of chat and out of git.

## ESAP backend on the server

| | |
|---|---|
| App folder | `/home/mubasshir/esap-backend` |
| Settings / secrets | `/home/mubasshir/esap-backend/.env` (Polar token, webhook secret, etc. Read them there, they are not copied here) |
| Database | `/home/mubasshir/esap-backend/esap.db` (+ `-wal`, `-shm`) |
| Python | `/home/mubasshir/esap-backend/.venv/bin/python` |
| Restart | `systemctl restart esap-backend` (as root) |
| Live log | `journalctl -u esap-backend -f` |
| Health | `curl http://127.0.0.1:8001/readyz` |
| Models | `/home/mubasshir/esap-models` |
| Backups | `/home/mubasshir/esap-backend-backup-YYYYMMDD-HHMMSS/` (latest: `...-20261117-121636`) |

## care.esap.ai test accounts

| Account | Email | Password |
|---|---|---|
| Demo clinical/patient roles + 6 admin/ops demo roles (14 accounts) | via `https://care.esap.ai/demo-role` | `esap-demo` |
| Super Admin (private on the picker) | type on `/login` | `esap-demo` |
| Second solo clinician (Issue 5 isolation check) | `qa-solo-2@esap-qa.example` | `esap-demo` |
| Other 76 accounts (incl. 9 real-email accounts) | n/a | individual passwords, in the CSV from 12 Nov |

## Not yet known / to add

- **no-reply@esap.ai SMTP** (MXroute): host, port (465 or 587), password. Needed to send real emails.
- **netcup control panel** login.
- `mubasshir` and `nabil` SSH passwords, if you want them recorded.
