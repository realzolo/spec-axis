module sykra/worker

go 1.24.0

	require (
		github.com/bmatcuk/doublestar/v4 v4.10.0
		github.com/gorilla/websocket v1.5.3
		sykra/conductor v0.0.0
	)

replace sykra/conductor => ../conductor
