IMGPROXY_ENV_FILE := imgproxy.env
LOCAL_FOLDER := /progapanda_art_sources

IMAGE_NAME := progapandist/progapanda-art
VERSION ?= latest

# Specify the Dockerfile for development and production
DOCKERFILE_PROD := Dockerfile

.PHONY: run-imgproxy

run-imgproxy:
	docker run -p 8080:8080 --env-file $(IMGPROXY_ENV_FILE) -v $(LOCAL_FOLDER):/progapanda_art_sources -it darthsim/imgproxy

# Build the Docker image for production with a custom tag
build-prod:
	docker build -f $(DOCKERFILE_PROD) -t $(IMAGE_NAME):$(VERSION) .

# Push the Docker image to Docker Hub
push:
	docker push $(IMAGE_NAME):$(VERSION)

build-push-prod: build-prod push

prod-console:
	kamal app exec 'bin/rails c' -i --reuse
