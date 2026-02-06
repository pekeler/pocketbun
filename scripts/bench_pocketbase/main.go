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
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/search"
	"github.com/pocketbase/pocketbase/tools/types"
)

const benchListPerPage = 30
const benchJSONPayload = `{"items":[{"id":"aaaaaaaaaaaaaaa","title":"Item 0","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 1","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 2","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 3","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 4","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 5","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 6","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 7","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 8","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 9","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 10","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 11","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 12","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 13","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 14","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 15","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 16","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 17","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 18","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 19","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 20","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 21","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 22","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 23","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 24","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 25","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 26","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 27","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 28","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 29","collectionId":"pbc_209201611","collectionName":"bench_items"}],"page":1,"perPage":30,"totalItems":1000,"totalPages":34}` + "\n"

func main() {
	port := readEnvInt("POCKETBUN_BENCH_PORT", 8093)
	recordCount := readEnvInt("POCKETBUN_BENCH_RECORDS", 1000)
	queryLogLimit := readEnvInt("POCKETBUN_BENCH_QUERYLOG_LIMIT", 10)
	disableLogs := readEnvBool("POCKETBUN_BENCH_DISABLE_LOGS")
	enableQueryMetrics := readEnvBool("POCKETBUN_BENCH_QUERY_METRICS")

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
	if disableLogs {
		app.Settings().Logs.MaxDays = 0
	}

	collection := core.NewBaseCollection("bench_items")
	collection.ListRule = types.Pointer("1=1")
	collection.ViewRule = types.Pointer("1=1")
	collection.Fields.Add(&core.TextField{Name: "title"})

	if err := app.Save(collection); err != nil {
		log.Fatal(err)
	}
	benchCollectionId := collection.Id
	benchCollectionName := collection.Name

	if _, err := app.DB().NewQuery("CREATE TABLE IF NOT EXISTS bench_counter (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)").Execute(); err != nil {
		log.Fatal(err)
	}
	if _, err := app.DB().NewQuery("INSERT OR IGNORE INTO bench_counter (id, value) VALUES (1, 0)").Execute(); err != nil {
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

	if enableQueryMetrics {
		if db, ok := app.ConcurrentDB().(*dbx.DB); ok {
			db.QueryLogFunc = queryLogFunc
			db.ExecLogFunc = execLogFunc
		}
		if db, ok := app.NonconcurrentDB().(*dbx.DB); ok {
			db.QueryLogFunc = queryLogFunc
			db.ExecLogFunc = execLogFunc
		}
	}

	serverReady := make(chan *http.Server, 1)
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			benchGroup := e.Router.Group("/_bench").Bind(apis.SkipSuccessActivityLog())
			benchGroup.GET("/ping", func(re *core.RequestEvent) error {
				return re.String(200, "pong")
			})
			benchGroup.GET("/json", func(re *core.RequestEvent) error {
				re.Response.Header().Set("Content-Type", "application/json")
				_, err := re.Response.Write([]byte(benchJSONPayload))
				return err
			})
			benchGroup.GET("/db_list", func(re *core.RequestEvent) error {
				skipTotal := shouldSkipTotal(re.Request.URL.Query().Get("skipTotal"))

				type benchRow struct {
					Id    string `db:"id"`
					Title string `db:"title"`
				}
				rows := make([]benchRow, 0, benchListPerPage)
				if err := app.DB().NewQuery("SELECT id, title FROM {{bench_items}} LIMIT 30").All(&rows); err != nil {
					return err
				}

				items := make([]map[string]any, len(rows))
				for i, row := range rows {
					items[i] = map[string]any{
						"id":             row.Id,
						"title":          row.Title,
						"collectionId":   benchCollectionId,
						"collectionName": benchCollectionName,
					}
				}

				totalItems := -1
				totalPages := -1
				if !skipTotal {
					var countRow struct {
						Total int `db:"total"`
					}
					if err := app.DB().NewQuery("SELECT COUNT(*) as total FROM {{bench_items}}").One(&countRow); err != nil {
						return err
					}
					totalItems = countRow.Total
					if totalItems == 0 {
						totalPages = 0
					} else {
						totalPages = (totalItems + benchListPerPage - 1) / benchListPerPage
					}
				}

				return re.JSON(200, map[string]any{
					"items":      items,
					"page":       1,
					"perPage":    benchListPerPage,
					"totalItems": totalItems,
					"totalPages": totalPages,
				})
			})
			benchGroup.GET("/provider_list", func(re *core.RequestEvent) error {
				query := app.RecordQuery(collection)

				resolver := core.NewRecordFieldResolver(app, collection, nil, true)
				if collection.ListRule != nil && *collection.ListRule != "" {
					expr, err := search.FilterData(*collection.ListRule).BuildExpr(resolver)
					if err != nil {
						return err
					}
					query.AndWhere(expr)
				}
				resolver.SetAllowHiddenFields(false)

				searchProvider := search.NewProvider(resolver).Query(query)
				if !collection.IsView() {
					searchProvider.CountCol("_rowid_")
				}

				records := []*core.Record{}
				result, err := searchProvider.ParseAndExec(re.Request.URL.Query().Encode(), &records)
				if err != nil {
					return err
				}

				return re.JSON(200, result)
			})
			benchGroup.POST("/db_write", func(re *core.RequestEvent) error {
				if _, err := app.DB().NewQuery("UPDATE bench_counter SET value = value + 1 WHERE id = 1").Execute(); err != nil {
					return err
				}
				return re.JSON(200, map[string]any{"ok": true})
			})
			benchGroup.GET("/metrics", func(re *core.RequestEvent) error {
				if !enableQueryMetrics {
					return re.JSON(200, map[string]any{})
				}
				queryLogMu.Lock()
				logSnapshot := append([]string(nil), queryLog...)
				queryLogMu.Unlock()
				return re.JSON(200, map[string]any{"queryCount": atomic.LoadInt64(&queryCount), "queryLog": logSnapshot})
			})
			benchGroup.POST("/reset", func(re *core.RequestEvent) error {
				if _, err := app.DB().NewQuery("UPDATE bench_counter SET value = 0 WHERE id = 1").Execute(); err != nil {
					return err
				}
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

func readEnvBool(name string) bool {
	if value := os.Getenv(name); value != "" {
		switch strings.ToLower(strings.TrimSpace(value)) {
		case "1", "t", "true", "y", "yes", "on":
			return true
		}
	}
	return false
}

func shouldSkipTotal(raw string) bool {
	if raw == "" {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "t", "true", "y", "yes", "on":
		return true
	default:
		return false
	}
}
