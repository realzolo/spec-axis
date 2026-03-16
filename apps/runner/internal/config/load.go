package config

import (
	"fmt"
	"os"
	"time"
)

type LoadOptions struct {
	ConfigPath string
}

func LoadWithOptions(opts LoadOptions) (Config, error) {
	cfg := Config{
		Port:                  "8200",
		RunnerToken:           "",
		DatabaseURL:           "",
		RedisURL:              "",
		EncryptionKey:         "",
		Concurrency:           4,
		Queue:                 "analysis",
		PipelineQueue:         "pipelines",
		PipelineConcurrency:   4,
		DataDir:               "data",
		LogRetentionDays:      30,
		ArtifactRetentionDays: 30,
	}

	analyzeTimeoutRaw := "300s"
	pipelineTimeoutRaw := "2h"

	configPath, err := resolveConfigPath(opts.ConfigPath)
	if err != nil {
		return Config{}, err
	}
	if configPath != "" {
		fileCfg, err := loadFileConfig(configPath)
		if err != nil {
			return Config{}, err
		}
		applyFileConfig(&cfg, fileCfg, &analyzeTimeoutRaw, &pipelineTimeoutRaw)
	}

	cfg.Port = envString("RUNNER_PORT", cfg.Port)
	cfg.RunnerToken = envString("RUNNER_TOKEN", cfg.RunnerToken)
	cfg.DatabaseURL = envString("DATABASE_URL", cfg.DatabaseURL)
	cfg.RedisURL = envString("REDIS_URL", cfg.RedisURL)
	cfg.EncryptionKey = envString("ENCRYPTION_KEY", cfg.EncryptionKey)
	cfg.Concurrency = envInt("RUNNER_CONCURRENCY", cfg.Concurrency)
	cfg.Queue = envString("RUNNER_QUEUE", cfg.Queue)
	cfg.PipelineQueue = envString("PIPELINE_QUEUE", cfg.PipelineQueue)
	cfg.PipelineConcurrency = envInt("PIPELINE_CONCURRENCY", cfg.PipelineConcurrency)
	cfg.DataDir = envString("RUNNER_DATA_DIR", cfg.DataDir)
	cfg.LogRetentionDays = envInt("PIPELINE_LOG_RETENTION_DAYS", cfg.LogRetentionDays)
	cfg.ArtifactRetentionDays = envInt("PIPELINE_ARTIFACT_RETENTION_DAYS", cfg.ArtifactRetentionDays)

	analyzeTimeoutRaw = envString("ANALYZE_TIMEOUT", analyzeTimeoutRaw)
	pipelineTimeoutRaw = envString("PIPELINE_RUN_TIMEOUT", pipelineTimeoutRaw)

	analyzeTimeout, err := time.ParseDuration(analyzeTimeoutRaw)
	if err != nil {
		return Config{}, fmt.Errorf("invalid ANALYZE_TIMEOUT: %w", err)
	}
	cfg.AnalyzeTimeout = analyzeTimeout

	pipelineTimeout, err := time.ParseDuration(pipelineTimeoutRaw)
	if err != nil {
		return Config{}, fmt.Errorf("invalid PIPELINE_RUN_TIMEOUT: %w", err)
	}
	cfg.PipelineRunTimeout = pipelineTimeout

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.RedisURL == "" {
		return Config{}, fmt.Errorf("REDIS_URL is required")
	}
	if cfg.EncryptionKey != "" && os.Getenv("ENCRYPTION_KEY") == "" {
		_ = os.Setenv("ENCRYPTION_KEY", cfg.EncryptionKey)
	}

	return cfg, nil
}
