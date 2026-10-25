# CSA SCRIPT is an IT tool for Marcellos Farm

Expected: A local file named DEV_CSA_lista.xlsx. (Export the order list gsheets document into this filename.)

Server:

source venv/bin/activate
python serve.py


Tunnel:

mkdir -p ~/.local/state
~/.local/bin/cloudflared tunnel --url http://127.0.0.1:8080 --no-autoupdate 2>&1 | tee ~/.local/state/csa-tunnel.log
