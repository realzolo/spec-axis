package internal

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port           string
	RunnerToken    string
	DatabaseURL    string
	RedisURL       string
	NatsURL        string
	Concurrency    int
	Queue          string
	AnalyzeTimeout time.Duration
}

func LoadConfig() (Config, error) {
	cfg := Config{
		Port:        envString("RUNNER_PORT", "8200"),
		RunnerToken: os.Getenv("RUNNER_TOKEN"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    os.Getenv("REDIS_URL"),
		NatsURL:     os.Getenv("NATS_URL"),
		Concurrency: envInt("RUNNER_CONCURRENCY", 4),
		Queue:       envString("RUNNER_QUEUE", "analysis"),
	}

	timeoutRaw := envString("ANALYZE_TIMEOUT", "300s")
	timeout, err := time.ParseDuration(timeoutRaw)
	if err != nil {
		return Config{}, fmt.Errorf("invalid ANALYZE_TIMEOUT: %w", err)
	}
	cfg.AnalyzeTimeout = timeout

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.RedisURL == "" {
		return Config{}, fmt.Errorf("REDIS_URL is required")
	}

	return cfg, nil
}

func envString(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}
