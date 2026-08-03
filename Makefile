.PHONY: install dev check up down logs migrate seed

install:
	npm ci

dev:
	npm run dev

check:
	npm run check

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f api worker

migrate:
	npm run db:migrate

seed:
	npm run db:seed
