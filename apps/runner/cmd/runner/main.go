package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hibiken/asynq"

	"spec-axis/runner/internal"
)

func main() {
	cfg, err := internal.LoadConfig()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	ctx := context.Background()
	store, err := internal.NewStore(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db error: %v", err)
	}
	defer store.Close()

	publisher, err := internal.NewPublisher(cfg.NatsURL)
	if err != nil {
		log.Fatalf("nats error: %v", err)
	}
	defer func() {
		if publisher != nil {
			publisher.Close()
		}
	}()

	redisOpt, err := internal.ParseRedisURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis error: %v", err)
	}

	queueWeights := map[string]int{cfg.Queue: 1}
	server := asynq.NewServer(redisOpt, asynq.Config{
		Concurrency: cfg.Concurrency,
		Queues:      queueWeights,
	})

	mux := asynq.NewServeMux()
	mux.HandleFunc(internal.TaskTypeAnalyze, internal.HandleAnalyzeTask(store, publisher, cfg.AnalyzeTimeout))

	go func() {
		if err := server.Run(mux); err != nil {
			log.Fatalf("asynq server error: %v", err)
		}
	}()

	client := asynq.NewClient(redisOpt)
	defer client.Close()

	httpServer := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: internal.NewHTTPServer(cfg, client).Handler(),
	}

	go func() {
		log.Printf("runner listening on :%s", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	server.Shutdown()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("http shutdown error: %v", err)
	}
}
