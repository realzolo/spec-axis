package internal

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/hibiken/asynq"
)

type HTTPServer struct {
	cfg    Config
	client *asynq.Client
}

func NewHTTPServer(cfg Config, client *asynq.Client) *HTTPServer {
	return &HTTPServer{cfg: cfg, client: client}
}

func (s *HTTPServer) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ready"))
	})

	mux.HandleFunc("/v1/tasks/analyze", s.handleAnalyze)

	return mux
}

func (s *HTTPServer) handleAnalyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !s.authorized(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	var payload AnalyzeRequest
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	if payload.ProjectID == "" || payload.ReportID == "" || payload.Repo == "" || len(payload.Hashes) == 0 {
		http.Error(w, "missing required fields", http.StatusBadRequest)
		return
	}

	task, err := NewAnalyzeTask(payload)
	if err != nil {
		http.Error(w, "failed to create task", http.StatusInternalServerError)
		return
	}

	options := []asynq.Option{
		asynq.Queue(s.cfg.Queue),
		asynq.MaxRetry(3),
		asynq.Timeout(s.cfg.AnalyzeTimeout),
	}
	if payload.ReportID != "" {
		options = append(options, asynq.TaskID("analyze:"+payload.ReportID))
	}

	info, err := s.client.Enqueue(task, options...)
	if err != nil {
		http.Error(w, "failed to enqueue task", http.StatusInternalServerError)
		return
	}

	resp := map[string]any{
		"taskId": info.ID,
	}
	writeJSON(w, http.StatusAccepted, resp)
}

func (s *HTTPServer) authorized(r *http.Request) bool {
	if s.cfg.RunnerToken == "" {
		return true
	}

	token := r.Header.Get("X-Runner-Token")
	if token == "" {
		auth := r.Header.Get("Authorization")
		if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
			token = strings.TrimSpace(auth[7:])
		}
	}

	return token != "" && token == s.cfg.RunnerToken
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	raw, _ := json.Marshal(payload)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(raw)
}
