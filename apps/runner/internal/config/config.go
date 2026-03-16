package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port                  string
	RunnerToken           string
	DatabaseURL           string
	RedisURL              string
	EncryptionKey         string
	Concurrency           int
	Queue                 string
	AnalyzeTimeout        time.Duration
	PipelineQueue         string
	PipelineConcurrency   int
	PipelineRunTimeout    time.Duration
	DataDir               string
	LogRetentionDays      int
	ArtifactRetentionDays int
}

func Load() (Config, error) {
	return LoadWithOptions(LoadOptions{})
}

func envString(key string, fallback string) string {
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
