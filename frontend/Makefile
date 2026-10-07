.PHONY: build run stop rebuild

APP_NAME = nestplate-frontend
PORT = 3001
INTERNAL_PORT = 3000

build:
	docker build \
		--build-arg VITE_GOOGLE_CLIENT_ID=$$(grep VITE_GOOGLE_CLIENT_ID .env | cut -d '=' -f2) \
		--build-arg VITE_API_URL=$$(grep VITE_API_URL .env | cut -d '=' -f2) \
		--build-arg VITE_GOOGLE_DRIVE_FOLDER_ID=$$(grep VITE_GOOGLE_DRIVE_FOLDER_ID .env | cut -d '=' -f2) \
		--build-arg VITE_GOOGLE_DRIVE_URL=$$(grep VITE_GOOGLE_DRIVE_URL .env | cut -d '=' -f2) \
		-t $(APP_NAME) .

stop:
	docker rm -f $(APP_NAME) || true

run:
	docker run -d \
		-p $(PORT):$(INTERNAL_PORT) \
		--add-host=host.docker.internal:host-gateway \
		--env-file .env \
		--name $(APP_NAME) \
		$(APP_NAME)

rebuild: stop build run
