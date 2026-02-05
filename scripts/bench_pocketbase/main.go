// PocketBun-only: local benchmark server for upstream PocketBase.

package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/types"
)

func main() {
	port := readEnvInt("POCKETBUN_BENCH_PORT", 8093)
	recordCount := readEnvInt("POCKETBUN_BENCH_RECORDS", 1000)
	queryLogLimit := readEnvInt("POCKETBUN_BENCH_QUERYLOG_LIMIT", 10)

	dataDir, err := os.MkdirTemp(os.TempDir(), "pocketbase-bench-")
	if err != nil {
		log.Fatal(err)
	}

	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir:  dataDir,
		HideStartBanner: true,
	})

	if err := app.Bootstrap(); err != nil {
		log.Fatal(err)
	}
	if err := app.RunAllMigrations(); err != nil {
		log.Fatal(err)
	}

	collection := core.NewBaseCollection("bench_items")
	collection.ListRule = types.Pointer("1=1")
	collection.ViewRule = types.Pointer("1=1")
	collection.Fields.Add(&core.TextField{Name: "title"})

	if err := app.Save(collection); err != nil {
		log.Fatal(err)
	}

	for i := 0; i < recordCount; i++ {
		record := core.NewRecord(collection)
		record.Set("title", fmt.Sprintf("Item %d", i))
		if err := app.Save(record); err != nil {
			log.Fatal(err)
		}
	}

	var queryCount int64
	var queryLog []string
	var queryLogMu sync.Mutex
	logQuery := func(query string) {
		atomic.AddInt64(&queryCount, 1)
		if queryLogLimit <= 0 {
			return
		}
		queryLogMu.Lock()
		if len(queryLog) < queryLogLimit {
			queryLog = append(queryLog, query)
		}
		queryLogMu.Unlock()
	}
	queryLogFunc := func(_ context.Context, _ time.Duration, query string, _ *sql.Rows, _ error) {
		logQuery(query)
	}
	execLogFunc := func(_ context.Context, _ time.Duration, query string, _ sql.Result, _ error) {
		logQuery(query)
	}

	if db, ok := app.ConcurrentDB().(*dbx.DB); ok {
		db.QueryLogFunc = queryLogFunc
		db.ExecLogFunc = execLogFunc
	}
	if db, ok := app.NonconcurrentDB().(*dbx.DB); ok {
		db.QueryLogFunc = queryLogFunc
		db.ExecLogFunc = execLogFunc
	}

	serverReady := make(chan *http.Server, 1)
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			benchGroup := e.Router.Group("/_bench").Bind(apis.SkipSuccessActivityLog())
			benchGroup.GET("/ping", func(re *core.RequestEvent) error {
				return re.String(200, "pong")
			})
			benchGroup.GET("/metrics", func(re *core.RequestEvent) error {
				queryLogMu.Lock()
				logSnapshot := append([]string(nil), queryLog...)
				queryLogMu.Unlock()
				return re.JSON(200, map[string]any{"queryCount": atomic.LoadInt64(&queryCount), "queryLog": logSnapshot})
			})
			benchGroup.POST("/reset", func(re *core.RequestEvent) error {
				atomic.StoreInt64(&queryCount, 0)
				queryLogMu.Lock()
				queryLog = nil
				queryLogMu.Unlock()
				return re.JSON(200, map[string]any{"ok": true})
			})

			serverReady <- e.Server
			return e.Next()
		},
	})

	go func() {
		err := apis.Serve(app, apis.ServeConfig{
			ShowStartBanner: false,
			HttpAddr:        fmt.Sprintf("127.0.0.1:%d", port),
		})
		if err != nil {
			log.Printf("serve error: %v", err)
		}
	}()

	server := <-serverReady
	fmt.Printf("READY %d %d\n", port, recordCount)

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, os.Interrupt, syscall.SIGTERM)
	<-sigs

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	_ = app.ResetBootstrapState()
	_ = os.RemoveAll(dataDir)
}

func readEnvInt(name string, fallback int) int {
	if value := os.Getenv(name); value != "" {
		parsed, err := strconv.Atoi(value)
		if err == nil {
			return parsed
		}
	}
	return fallback
}
