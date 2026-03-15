package internal

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"time"
)

func httpPostJSON(url string, payload []byte) ([]byte, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("webhook error: %s", resp.Status)
	}

	return io.ReadAll(resp.Body)
}
