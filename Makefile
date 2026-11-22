# Run from WSL or Git Bash. Windows users without make: see scripts/ for equivalents.
SHELL := bash
export AWS_PROFILE ?= warehouse
export AWS_REGION ?= ap-southeast-2
export AWS_PAGER :=

WEB := apps/web
API := apps/api

.PHONY: setup dev-mock dev check check-web check-api gen-api shots infra-up deploy infra-down

setup:
	pnpm install
	cd $(API) && uv sync

dev-mock:
	pnpm --dir $(WEB) dev:mock

dev:
	docker compose up -d --build db api
	pnpm --dir $(WEB) dev

check: check-web check-api

check-web:
	pnpm --dir $(WEB) lint
	pnpm --dir $(WEB) typecheck
	pnpm --dir $(WEB) test
	pnpm --dir $(WEB) i18n:check

check-api:
	cd $(API) && uv run ruff check . && uv run ruff format --check . && uv run pytest -q

gen-api:
	cd $(API) && uv run python -m app.export_openapi openapi.json
	pnpm --dir $(WEB) gen-api

shots:
	bash scripts/shots.sh

infra-up:
	bash scripts/infra-up.sh

deploy:
	bash scripts/deploy.sh

infra-down:
	bash scripts/infra-down.sh
