PROJECT := progapanda-art
DROPLET := art-gallery
DROPLET_IP := 165.232.72.204
IMGPROXY_ENV_FILE := imgproxy.env
SOURCES_DIR := /Users/progapandist/progapanda_art_sources
LOCAL_IMGPROXY := http://localhost:8080
# The public URL is same-origin (functions/i/[[path]].js proxies+caches to
# the droplet) — not the droplet directly, and not a separate *.workers.dev
# domain either: a shared third-party-looking CDN domain is exactly the kind
# of thing Safari's tracking/fingerprinting protection reacts to. IMGPROXY_ORIGIN
# is where the build itself fetches placeholder bytes from — always the real
# origin, since the /i/ proxy doesn't exist to fetch from until this deploy
# finishes.
PROD_IMGPROXY := https://art.progapanda.org/i
IMGPROXY_ORIGIN := https://imgproxy.progapanda.org
LOAD_DOTENV := set -a; [ -f .env ] && . ./.env; set +a;
export SOURCES_DIR

.PHONY: run-imgproxy stop-imgproxy dev test dist deploy deploy-frontend deploy-imgproxy sync-sources warm-cache clean

# ---- local dev: always against the LOCAL imgproxy container ---------------

# Adding or removing a work is editing $(SOURCES_DIR) and running `make dist`
# (or letting `make dev`'s watcher pick it up) — content.md's sections are
# reconciled against that folder on every build.
run-imgproxy:
	$(LOAD_DOTENV) docker run -p 8080:8080 --env-file $(IMGPROXY_ENV_FILE) \
		-e IMGPROXY_KEY -e IMGPROXY_SALT \
		-v $(SOURCES_DIR):/progapanda_art_sources -it \
		darthsim/imgproxy:v4

stop-imgproxy:
	docker stop imgproxy && docker rm imgproxy

# Run this alongside `make run-imgproxy` in another terminal.
dev:
	$(LOAD_DOTENV) IMGPROXY_ENDPOINT=$(LOCAL_IMGPROXY) bun run build.js --watch & bun run server.js; kill %1 2>/dev/null

test:
	bun test

dist:
	$(LOAD_DOTENV) IMGPROXY_ENDPOINT=$(LOCAL_IMGPROXY) bun run build.js

# ---- deploy: always against the PRODUCTION imgproxy ------------------------

deploy-frontend: test
	$(LOAD_DOTENV) IMGPROXY_ENDPOINT=$(PROD_IMGPROXY) IMGPROXY_ORIGIN=$(IMGPROXY_ORIGIN) bun run build.js
	wrangler pages deploy dist --project-name $(PROJECT)

deploy: deploy-imgproxy deploy-frontend

# Mirrors $(SOURCES_DIR) onto the droplet's /data/art_sources — --delete so a
# file removed locally (the same "editing the folder" workflow as content.md's
# reconciliation) actually disappears from production too, not just from the
# local build. The chmod afterward (not an rsync --chmod flag — macOS ships
# openrsync, which doesn't support the GNU F644 syntax) makes every file
# world-readable regardless of local permissions (a couple of the source
# files are owner-only on disk) — imgproxy's container process needs to read
# every file here regardless.
sync-sources:
	rsync -av --delete $(SOURCES_DIR)/ root@$(DROPLET_IP):/data/art_sources/
	doctl compute ssh $(DROPLET) --ssh-command "chmod a+r /data/art_sources/*"

# Pre-warms imgproxy's origin cache with every URL the site generates, so
# the first real visitor never pays a cold multi-second AVIF encode — that
# cost lands here instead. An already-warm URL is just a cache-hit fetch
# (fast); it's the whole ~1300-combo catalog on an empty cache that takes
# minutes. deploy-imgproxy fires this automatically in the background (see
# below) after every restart; run it directly yourself if you want to:
#   make warm-cache            # foreground, watch it work
#   make warm-cache &          # background, keep using this shell
#   nohup make warm-cache > warm-cache.log 2>&1 &   # detached, survives closing the terminal
warm-cache:
	$(LOAD_DOTENV) IMGPROXY_ORIGIN=$(IMGPROXY_ORIGIN) bun run warm.js

# imgproxy lives on the droplet, run directly via doctl/docker — not Kamal.
# First run only: tear down the leftover Kamal-managed containers (traefik,
# the old rails app, the old imgproxy accessory) by hand before this target
# ever runs, since it assumes ports 80/443/8080 are free.
deploy-imgproxy: sync-sources
	$(LOAD_DOTENV) tmp=$$(mktemp); \
	cat $(IMGPROXY_ENV_FILE) > $$tmp; \
	echo "IMGPROXY_KEY=$$IMGPROXY_KEY" >> $$tmp; \
	echo "IMGPROXY_SALT=$$IMGPROXY_SALT" >> $$tmp; \
	scp $$tmp root@$(DROPLET_IP):/root/imgproxy.env; \
	rm $$tmp
	scp Caddyfile root@$(DROPLET_IP):/root/Caddyfile
	doctl compute ssh $(DROPLET) --ssh-command "\
		docker network create imgproxy-net 2>/dev/null; \
		docker pull darthsim/imgproxy:v4; \
		docker pull caddy:2; \
		docker rm -f imgproxy caddy 2>/dev/null; \
		mkdir -p /data/imgproxy-cache; \
		docker run -d --name imgproxy --network imgproxy-net --restart unless-stopped \
			--env-file /root/imgproxy.env \
			-v /data/art_sources:/progapanda_art_sources:ro \
			-v /data/imgproxy-cache:/imgproxy-cache \
			darthsim/imgproxy:v4; \
		docker run -d --name caddy --network imgproxy-net --restart unless-stopped \
			-p 80:80 -p 443:443 \
			-v /root/Caddyfile:/etc/caddy/Caddyfile:ro \
			-v caddy_data:/data \
			caddy:2"
	nohup $(MAKE) warm-cache > warm-cache.log 2>&1 & disown
	@echo "imgproxy restarted — cache warm running in the background (tail -f warm-cache.log to watch it)."

clean:
	rm -rf dist
