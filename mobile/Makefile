.PHONY: help run start update restart rebuild clean install dev ios android web clear-cache test test-watch test-coverage

# Default target
help:
	@echo "Available commands:"
	@echo "  make run          - Start the Expo development server"
	@echo "  make start        - Alias for 'make run'"
	@echo "  make dev          - Start with cache cleared"
	@echo "  make ios          - Start on iOS simulator"
	@echo "  make android      - Start on Android emulator"
	@echo "  make web          - Start web version"
	@echo "  make update       - Update all dependencies"
	@echo "  make restart      - Restart the development server"
	@echo "  make rebuild      - Clean and reinstall everything"
	@echo "  make install      - Install dependencies"
	@echo "  make clear-cache  - Clear Expo and npm cache"
	@echo "  make clean        - Remove node_modules and cache"
	@echo "  make test         - Run unit tests"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo "  make test-coverage - Run tests with coverage report"

# Start the development server
run:
	npx expo start

# Alias for run
start: run

# Start with cache cleared
dev:
	npx expo start --clear

# Start on iOS
ios:
	npx expo start --ios

# Start on Android
android:
	npx expo start --android

# Start web version
web:
	npx expo start --web

# Install dependencies
install:
	npm install

# Update dependencies
update:
	npm update
	npx expo install --fix

# Clear cache
clear-cache:
	npx expo start --clear
	npm cache clean --force

# Restart server (stop and start fresh)
restart:
	@echo "Restarting Expo server..."
	@pkill -f "expo start" || true
	@sleep 1
	npx expo start --clear

# Clean everything
clean:
	@echo "Cleaning node_modules and cache..."
	rm -rf node_modules
	rm -rf .expo
	rm -rf .expo-shared
	npm cache clean --force

# Rebuild from scratch
rebuild: clean
	@echo "Installing dependencies..."
	npm install
	@echo "Starting development server..."
	npx expo start --clear

# Run unit tests
test:
	npm test

# Run tests in watch mode
test-watch:
	npm run test:watch

# Run tests with coverage
test-coverage:
	npm run test:coverage
