# Foliyo Makefile — pnpm + turbo local development

TMUX_SESSION := foliyo-dev
ROOT := $(CURDIR)
DATA_DIR := $(ROOT)/data

CORE_URL := http://localhost:8080
DASHBOARD_URL := http://localhost:5173
LANDING_URL := http://localhost:5175

export FOLIYO_ADMIN_EMAIL ?= admin@localhost
export FOLIYO_ADMIN_PASSWORD ?= changeme
export FOLIYO_DATA_DIR ?= $(DATA_DIR)
export FOLIYO_DB_PATH ?= $(DATA_DIR)/foliyo.db

# Sibling private SaaS DB (foliyo-cloud API cwd resolves ./data → apps/api/data)
CLOUD_ROOT := $(ROOT)/../foliyo-cloud
CLOUD_API_DATA := $(CLOUD_ROOT)/apps/api/data
CLOUD_DB_PATH := $(CLOUD_API_DATA)/foliyo-cloud.db

.PHONY: all help setup deps build test clean release
.PHONY: dev dev-all-tmux dev-stop-tmux dev-attach-tmux dev-status-tmux
.PHONY: dev-core dev-dashboard dev-landing sync-brand migrate migrate-fresh seed-demo seed-demo-cloud health

dev: deps dev-all-tmux

setup:
	@./scripts/setup-dev.sh

deps:
	@pnpm install

sync-brand:
	@./scripts/sync-brand-assets.sh

build:
	@pnpm build

test:
	@pnpm test

clean:
	@pnpm clean 2>/dev/null || true
	@rm -rf dist data/*.db apps/core/data/*.db 2>/dev/null || true
	@echo "Clean complete."

release:
	@./scripts/release.sh

dev-core:
	@mkdir -p $(DATA_DIR)
	@cd apps/core && pnpm dev

dev-dashboard:
	@cd apps/dashboard && pnpm dev

dev-landing:
	@cd ../foliyo-cloud && pnpm --filter @foliyo/cloud-landing dev

dev-all-tmux:
	@command -v tmux >/dev/null 2>&1 || { echo "tmux is required. Install: brew install tmux"; exit 1; }
	@mkdir -p $(DATA_DIR)
	@echo "Starting Foliyo dev stack in tmux session '$(TMUX_SESSION)'..."
	@tmux has-session -t $(TMUX_SESSION) 2>/dev/null && tmux kill-session -t $(TMUX_SESSION) || true
	@tmux new-session -d -s $(TMUX_SESSION) -n main -c "$(ROOT)"
	@tmux split-window -h -t $(TMUX_SESSION):main
	@tmux split-window -v -t $(TMUX_SESSION):main.0
	@tmux select-layout -t $(TMUX_SESSION):main tiled
	@tmux send-keys -t $(TMUX_SESSION):main.0 \
		'export FOLIYO_ADMIN_EMAIL=$(FOLIYO_ADMIN_EMAIL) FOLIYO_ADMIN_PASSWORD=$(FOLIYO_ADMIN_PASSWORD) FOLIYO_DATA_DIR=$(FOLIYO_DATA_DIR) FOLIYO_DB_PATH=$(FOLIYO_DB_PATH) && cd apps/core && pnpm dev' Enter
	@tmux send-keys -t $(TMUX_SESSION):main.1 \
		'cd apps/dashboard && pnpm dev' Enter
	@tmux send-keys -t $(TMUX_SESSION):main.2 \
		'cd $(ROOT)/../foliyo-cloud && pnpm --filter @foliyo/cloud-landing dev' Enter
	@tmux select-pane -t $(TMUX_SESSION):main.0
	@echo ""
	@echo "Tmux session '$(TMUX_SESSION)' — 3 panes:"
	@echo "  [0] core      → $(CORE_URL)"
	@echo "  [1] dashboard → $(DASHBOARD_URL)"
	@echo "  [2] landing   → $(LANDING_URL)"
	@echo ""
	@echo "  Login: $(FOLIYO_ADMIN_EMAIL) / $(FOLIYO_ADMIN_PASSWORD)"
	@echo ""
	@if [ -n "$$TMUX" ]; then tmux switch-client -t $(TMUX_SESSION); else tmux attach -t $(TMUX_SESSION); fi

dev-attach-tmux:
	@tmux attach -t $(TMUX_SESSION) || echo "No session '$(TMUX_SESSION)'. Run: make dev"

dev-stop-tmux:
	@tmux kill-session -t $(TMUX_SESSION) 2>/dev/null || echo "No session found."

dev-status-tmux:
	@tmux has-session -t $(TMUX_SESSION) 2>/dev/null && echo "Running" || echo "Stopped"

migrate:
	@mkdir -p $(DATA_DIR)
	@cd apps/core && pnpm migrate

migrate-fresh:
	@rm -f $(DATA_DIR)/foliyo.db apps/core/data/foliyo.db 2>/dev/null || true
	@$(MAKE) migrate

seed-demo:
	@cd apps/core && pnpm seed:demo $(ARGS)

# Seed the cloud API sqlite (what :8080 uses when foliyo-cloud is running).
# Always use absolute paths — relative FOLIYO_DB_PATH breaks because seed cwd is apps/core.
seed-demo-cloud:
	@mkdir -p "$(CLOUD_API_DATA)"
	@echo "Seeding cloud DB → $(CLOUD_DB_PATH)"
	@cd apps/core && FOLIYO_DB_PATH="$(CLOUD_DB_PATH)" FOLIYO_DATA_DIR="$(CLOUD_API_DATA)" pnpm seed:demo $(ARGS)

health:
	@curl -sf -o /dev/null $(CORE_URL)/welcome && echo "Core OK" || echo "Core DOWN"
	@curl -sf -o /dev/null $(DASHBOARD_URL) && echo "Dashboard OK" || echo "Dashboard DOWN"
	@curl -sf -o /dev/null $(LANDING_URL) && echo "Landing OK" || echo "Landing DOWN"

help:
	@echo "Foliyo — Hono + MeshQL + SvelteKit"
	@echo "  make setup        One-time dev setup (Node 22.5+, pnpm)"
	@echo "  make dev          core + dashboard + landing in tmux"
	@echo "  make sync-brand   copy @foliyo/brand assets into static dirs"
	@echo "  make build        turbo build"
	@echo "  make migrate      run SQL migrations"
	@echo "  make seed-demo    fill OSS DB data/foliyo.db (ARGS=--force to reset)"
	@echo "  make seed-demo-cloud  fill cloud DB (foliyo-cloud apps/api/data)"
	@echo "  make migrate-fresh wipe DB + migrate"

.DEFAULT_GOAL := help
