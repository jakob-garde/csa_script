# CSA SCRIPT is an IT tool for Marcellos Farm

Expected: A local file named DEV_CSA_lista.xlsx. (Export the order list gsheets document into this filename.)

Server:

source venv/bin/activate
python serve.py


Tunnel:

mkdir -p ~/.local/state
~/.local/bin/cloudflared tunnel --url http://127.0.0.1:8080 --no-autoupdate 2>&1 | tee ~/.local/state/csa-tunnel.log

Hosting:

The pages can be served from the Pi, or from a machine at the office. Either way `serve.py` listens on port 8080. On the Pi it runs as the `csa-pages` service, from `csa.service`. Set `User` and `WorkingDirectory` in that file to the account and the checkout, stop the copy started by hand, then:

```
sudo cp csa.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now csa
```

`journalctl -u csa` shows the same page requests. The service starts again after a reboot.

Refresh from outside, after the service has the two `Environment` lines from `tools/csa.service`. On the serving machine, put a passphrase on the first line of `~/.local/state/csa-refresh-pass`. Then open `http://<the public address>/refresh` with `http://` typed in the bar, and enter that passphrase. The machine pulls the order list and replaces the pages. Reload the lists. This passphrase is checked by the server. It is not the password on the generated pages. The private `csa_script_tools` folder has to sit next to this checkout, because that is what runs the pull.

The router holds the public address. One forward sends port 80 on that address to port 8080 on the chosen machine. The forward has been tried from the public web, with the Pi as the machine, and the page requests show up in the Pi's server log.

When the public address changes, the server keeps running. The forward names the machine by its address inside the house, so nothing there has to be restarted. A daily check on the serving machine reports the new address.

The name members would use is a subdomain of marcellosfarm.se. The domain is at Loopia. In Kundzon, the DNS-editor gets one A record for that name, with TTL 300, pointed at the public address. The record for marcellosfarm.se itself stays as it is. A saved change is remembered for at most five minutes, then visitors get the new address. That name is not set up yet. It waits on the farm's hosting plan.
