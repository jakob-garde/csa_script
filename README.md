# CSA SCRIPT is an IT tool for Marcellos Farm

Local export of the order list: `DEV_CSA_lista.xlsx`.

### Generate: Generate automatically reads the order list file.

python3 generate.py

### Pull: Hard-code the sheet URL here (as DEFAULT_SHEET):

python3 tools/pull.py

Pull, then regenerate `out/`. Generate uses `venv/bin/python3` when that interpreter exists.

### Refresh:

python3 tools/refresh.py

## Server:

`/refresh` asks for the passphrase in `~/.local/state/csa-refresh-pass`. That is not the password on the generated pages. Open it with `http://` typed in the bar.

source venv/bin/activate
python serve.py

mkdir -p ~/.local/state
printf '%s\n' 'passphrase' > ~/.local/state/csa-refresh-pass

### Manual Tunnel from a local host:

mkdir -p ~/.local/state
~/.local/bin/cloudflared tunnel --url http://127.0.0.1:8080 --no-autoupdate 2>&1 | tee ~/.local/state/csa-tunnel.log

## Daemon:

Daemon, on the Pi or a machine at the office. Set `User`, `WorkingDirectory`, and `CSA_REFRESH_PASSFILE` in `tools/csa.service`. The router forwards port 80 to 8080. The forward names the machine by its address inside the house, so a new public address needs no restart. Log: `journalctl -u csa`.

sudo cp tools/csa.service /etc/systemd/system/csa.service
sudo systemctl daemon-reload
sudo systemctl enable --now csa

## Daily check:

Prints only when the public address changes or the pages stop answering. The first run records the address. `--accept` stores a new one.

15 7 * * * python3 /path/to/csa_script/tools/check.py
python3 tools/check.py --accept


## Domain Name:

Name, not set up yet. A subdomain of marcellosfarm.se, in Loopia's DNS-editor, one A record, TTL 300. Leave the `marcellosfarm.se` record as it is.
