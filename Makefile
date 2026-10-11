# Migration Atlas — common tasks. `make help` lists them.
SHELL := /bin/bash
API_PORT ?= 8014
WEB_PORT ?= 3014
PY := apps/backend/.venv/bin/python

.DEFAULT_GOAL := help
.PHONY: help dev setup api web test test-api test-web typecheck smoke build clean model

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

dev: ## Install what's missing and run backend + web (same as ./start.sh)
	@API_PORT=$(API_PORT) WEB_PORT=$(WEB_PORT) ./start.sh

setup: ## Install backend (venv) and web (node_modules) dependencies
	@cd apps/backend && (command -v uv >/dev/null && uv venv -q .venv && VIRTUAL_ENV=.venv uv pip install -q -e ".[dev]" || (python3 -m venv .venv && .venv/bin/pip install -q -e ".[dev]"))
	@cd apps/web && npm install --no-audit --no-fund

api: ## Run only the API with auto-reload
	@cd apps/backend && .venv/bin/python -m uvicorn atlas.main:app --reload --port $(API_PORT)

web: ## Run only the web app
	@cd apps/web && NEXT_PUBLIC_API_URL=http://127.0.0.1:$(API_PORT) WEB_PORT=$(WEB_PORT) npm run dev

test: test-api test-web ## Run all tests

test-api: ## Backend tests (pytest)
	@cd apps/backend && .venv/bin/python -m pytest -q

test-web: ## Frontend component tests (vitest)
	@cd apps/web && npx vitest run

typecheck: ## TypeScript strict type-check
	@cd apps/web && npx tsc --noEmit

smoke: ## End-to-end demo journey against a running API (scripts/smoke_test.py)
	@$(PY) scripts/smoke_test.py --api http://127.0.0.1:$(API_PORT)

build: ## Production build of the web app
	@cd apps/web && npx next build

model: ## Pull the default local model
	@ollama pull qwen3:4b

clean: ## Remove local data (projects, knowledge store) — asks first
	@read -p "Delete ./data (projects and ingested docs)? [y/N] " a; [ "$$a" = "y" ] && rm -rf data && echo removed || echo kept
