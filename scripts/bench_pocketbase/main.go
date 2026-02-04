// PocketBun-only: local benchmark server for upstream PocketBase.

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/types"
)

func main() {
	port := readEnvInt("POCKETBUN_BENCH_PORT", 8093)
	recordCount := readEnvInt("POCKETBUN_BENCH_RECORDS", 1000)

	dataDir, err := os.MkdirTemp(os.TempDir(), "pocketbase-bench-")
	if err != nil {
		log.Fatal(err)
	}

	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir: dataDir,
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

	serverReady := make(chan *http.Server, 1)
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
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
