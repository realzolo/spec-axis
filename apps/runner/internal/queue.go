package internal

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/hibiken/asynq"
)

const TaskTypeAnalyze = "task:analyze"

func NewAnalyzeTask(payload AnalyzeRequest) (*asynq.Task, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TaskTypeAnalyze, raw), nil
}

func HandleAnalyzeTask(store *Store, publisher *Publisher, timeout time.Duration) asynq.HandlerFunc {
	return func(ctx context.Context, task *asynq.Task) error {
		var payload AnalyzeRequest
		if err := json.Unmarshal(task.Payload(), &payload); err != nil {
			return err
		}

		err := RunAnalyzeTask(ctx, store, publisher, payload, timeout)
		if err != nil {
			log.Printf("analyze task failed: %v", err)
			_ = store.MarkReportFailed(ctx, payload.ReportID, err.Error())
			if publisher != nil {
				publisher.ReportStatus(payload.ReportID, "failed", nil)
			}
			return err
		}

		return nil
	}
}
