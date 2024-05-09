IMGPROXY_ENV_FILE := imgproxy.env
LOCAL_FOLDER := /Users/progapandist/progapanda_art_sources

.PHONY: run-imgproxy

run-imgproxy:
	docker run -p 8080:8080 --env-file $(IMGPROXY_ENV_FILE) -v $(LOCAL_FOLDER):/progapanda_art_sources -it darthsim/imgproxy
