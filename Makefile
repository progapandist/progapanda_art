PROJECT := progapanda-art
DROPLET := art-gallery
DROPLET_IP := 165.232.72.204
IMGPROXY_ENV_FILE := imgproxy.env
SOURCES_DIR := /Users/progapandist/progapanda_art_sources
LOCAL_IMGPROXY := http://localhost:8080
SITE := https://art.progapanda.org
PROD_IMGPROXY := $(SITE)/i
IMGPROXY_ORIGIN := https://imgproxy.progapanda.org
LOAD_DOTENV := set -a; [ -f .env ] && . ./.env; set +a;
export SOURCES_DIR

.PHONY: run-imgproxy stop-imgproxy dev test dist deploy deploy-commit deploy-frontend deploy-imgproxy sync-sources warm-cache clean

run-imgproxy:
	$(LOAD_DOTENV) docker run --name imgproxy --rm -p 8080:8080 --env-file $(IMGPROXY_ENV_FILE) \
		-e IMGPROXY_KEY -e IMGPROXY_SALT \
		-v $(SOURCES_DIR):/progapanda_art_sources -it \
		darthsim/imgproxy:v4

stop-imgproxy:
	docker stop imgproxy

dev:
	$(LOAD_DOTENV) IMGPROXY_ENDPOINT=$(LOCAL_IMGPROXY) bun run build.js --watch & builder=$$!; trap 'kill $$builder 2>/dev/null' EXIT INT TERM; bun run server.js

test:
	bun test

dist:
	$(LOAD_DOTENV) IMGPROXY_ENDPOINT=$(LOCAL_IMGPROXY) bun run build.js

deploy-frontend: test
	$(LOAD_DOTENV) IMGPROXY_ENDPOINT=$(PROD_IMGPROXY) IMGPROXY_ORIGIN=$(IMGPROXY_ORIGIN) bun run build.js
	wrangler pages deploy dist --project-name $(PROJECT)

deploy: deploy-imgproxy deploy-frontend
	@echo ""
	@echo "deployed. imgproxy has no result cache (see warm-cache below), so a"
	@echo "new or changed image is live immediately but slow-ish (real encode) for"
	@echo "whoever hits it first. Optional: make warm-cache (backgroundable, several"
	@echo "minutes) to pre-warm Cloudflare's edge cache instead of leaving that to visitors."

deploy-commit: deploy
	git add -A
	git diff --cached --quiet || git commit -m "deploy: $$(date -u +"%Y-%m-%d %H:%M UTC")"
	git push

sync-sources:
	rsync -av --delete $(SOURCES_DIR)/ root@$(DROPLET_IP):/data/art_sources/
	doctl compute ssh $(DROPLET) --ssh-command "chmod a+r /data/art_sources/*"

warm-cache:
	pkill -f "bun run warm.js" 2>/dev/null || true
	$(LOAD_DOTENV) IMGPROXY_ENDPOINT=$(PROD_IMGPROXY) bun run warm.js

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
		docker run -d --name imgproxy --network imgproxy-net --restart unless-stopped \
			--env-file /root/imgproxy.env \
			-v /data/art_sources:/progapanda_art_sources:ro \
			darthsim/imgproxy:v4; \
		docker run -d --name caddy --network imgproxy-net --restart unless-stopped \
			-p 80:80 -p 443:443 \
			-v /root/Caddyfile:/etc/caddy/Caddyfile:ro \
			-v caddy_data:/data \
			caddy:2"

clean:
	rm -rf dist dist.tmp dist.old
