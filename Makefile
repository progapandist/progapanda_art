IMGPROXY_ENV_FILE := imgproxy.env
LOCAL_FOLDER := /Users/progapandist/progapanda_art_sources

IMAGE_NAME := progapandist/progapanda-art
VERSION ?= latest
LOAD_DOTENV := set -a; [ -f .env ] && . ./.env; set +a;

# Specify the Dockerfile for development and production
DOCKERFILE_PROD := Dockerfile

.PHONY: run-imgproxy

run-imgproxy:
	docker run -p 8080:8080 --env-file $(IMGPROXY_ENV_FILE) -v $(LOCAL_FOLDER):/progapanda_art_sources -it \
		darthsim/imgproxy

stop-imgproxy:
	docker stop imgproxy && docker rm imgproxy

# Build the Docker image for production with a custom tag
build-prod:
	docker build -f $(DOCKERFILE_PROD) -t $(IMAGE_NAME):$(VERSION) .

# Push the Docker image to Docker Hub
push:
	docker push $(IMAGE_NAME):$(VERSION)

deploy:
	$(LOAD_DOTENV) kamal deploy -v
	$(LOAD_DOTENV) kamal app boot

build-push-prod: build-prod push

prod-console:
	$(LOAD_DOTENV) kamal app exec 'bin/rails c' -i --reuse

sqlite-db-prepare:
	$(LOAD_DOTENV) kamal app exec 'bin/rails db:migrate db:seed' --reuse

bash:
	$(LOAD_DOTENV) kamal app exec 'bash' -i --reuse

imgproxy-bash:
	$(LOAD_DOTENV) kamal accessory exec imgproxy 'bash' -i --reuse
