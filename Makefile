# Foodstream — local development entry point.
#   make dev      prepares .env, starts Postgres + backend (waits until healthy), then Metro for the mobile app
#   make help     lists everything
SHELL := bash
COMPOSE ?= docker compose
# Metro must not use 8081: that is the backend's port.
METRO_PORT ?= 8082

.DEFAULT_GOAL := help
.PHONY: help setup up full dev mobile seed down restart logs ps reset test test-backend test-mobile test-web test-scripts

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup: ## Create .env (JWT secret, DEV_MODE), set WEBRTC_IP to the LAN address, check the API port
	@./scripts/dev-setup.sh

up: setup ## Start Postgres + backend and wait until they are healthy
	$(COMPOSE) up -d --build --wait postgres backend
	@echo
	@echo "  API      http://localhost:8081/api    (Swagger: /api/swagger/index.html)"
	@echo "  Logs     make logs"

full: setup ## Start everything: Postgres, backend, web front and analytics dashboard
	$(COMPOSE) up -d --build --wait
	@echo
	@echo "  Web      http://localhost:3000    Analytics  http://localhost:3001    API  http://localhost:8081/api"

dev: up mobile ## Backend + Metro (the whole mobile dev loop)

mobile: ## Start Metro for the mobile app (port 8082, override with METRO_PORT=...)
	@[ -d mobile/node_modules ] || (cd mobile && npm install)
	@echo "Metro on port $(METRO_PORT). In the dev client choose http://<this machine's IP>:$(METRO_PORT) or scan the QR code."
	cd mobile && npx expo start --port $(METRO_PORT)

seed: ## Create demo accounts (demo.host / demo.viewer @example.com) and a scheduled live (needs DEV_MODE=true)
	@./scripts/seed.sh

down: ## Stop the containers (data is kept)
	$(COMPOSE) down

restart: ## Rebuild and restart the backend only
	$(COMPOSE) up -d --build --wait backend

logs: ## Follow the backend logs
	$(COMPOSE) logs -f --tail=100 backend

ps: ## Show the containers
	$(COMPOSE) ps

reset: ## Stop everything and DELETE the database and the replays/uploads volumes
	@read -p "This deletes the database, replays and uploads. Type 'yes' to continue: " answer && [ "$$answer" = "yes" ]
	$(COMPOSE) down -v

test: test-backend test-mobile test-web test-scripts ## Run every test suite

test-backend: ## Go: vet + tests with the race detector
	cd backend && go vet ./... && go test -race ./...

test-mobile: ## Mobile: types, lint, jest
	cd mobile && npx tsc --noEmit && npx expo lint && CI=true npx jest

test-web: ## Web: types, lint
	cd front-web && npx tsc --noEmit && npm run lint

test-scripts: ## Shell tests of the dev scripts (dev-setup, seed)
	@./scripts/test-dev-setup.sh
	@set -o pipefail; ./scripts/test-seed.sh 2>&1 | grep -v -E '^(-{10,}|Traceback|  File|    |Exception occurred|KeyError)'
