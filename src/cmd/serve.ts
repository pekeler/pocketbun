// Ported from pocketbase/cmd/serve.go

import type { App } from "../core/app.ts";
import { serveAsync, unsupportedAutomaticHTTPSError } from "../apis/serve.ts";
import { clusterEnabled, clusterWorkerAddress } from "../internal/cluster/context.ts";
import { Command } from "../tools/cli/command.ts";

export type ServeCommandState = {
  allowedOrigins: string[];
  httpAddr: string;
  httpsAddr: string;
};

export function newServeCommandState(): ServeCommandState {
  return {
    allowedOrigins: ["*"],
    httpAddr: "",
    httpsAddr: "",
  };
}

export function NewServeCommand(app: App, showStartBanner: boolean, state = newServeCommandState()): Command {
  const command = new Command({
    Use: "serve",
    Short: "Starts the web server (default to 127.0.0.1:8090)",
    SilenceUsage: true,
  });

  command.RunE = async (_cmd, args) => {
    if (args.length > 0 || state.httpsAddr) {
      return unsupportedAutomaticHTTPSError();
    }

    state.httpAddr = clusterWorkerAddress() || state.httpAddr || "127.0.0.1:8090";

    try {
      const server = await serveAsync(app, {
        httpAddr: state.httpAddr,
        httpsAddr: state.httpsAddr,
        showStartBanner: showStartBanner && !clusterEnabled(),
        allowedOrigins: state.allowedOrigins,
        certificateDomains: args,
      });

      if (clusterEnabled()) {
        const { notifyClusterWorkerReady } = await import("../internal/cluster/worker.ts");
        await notifyClusterWorkerReady(server);
      }

      // Keep the command alive until app termination and resolve after the
      // terminate hook chain finishes (including graceful server shutdown).
      await new Promise<void>((resolve) => {
        let hookId = "";
        hookId = app.OnTerminate().Bind({
          Id: "__pbServeCommandWaitTerminate__",
          Priority: 9999,
          Func: (event) => {
            app.OnTerminate().Unbind(hookId);
            resolve();
            return event.Next();
          },
        });
      });
      return null;
    } catch (err) {
      return err as Error;
    }
  };

  command.PersistentFlags().StringSliceVar(state, "allowedOrigins", "origins", ["*"], "CORS allowed domain origins list");
  command
    .PersistentFlags()
    .StringVar(state, "httpAddr", "http", "", "TCP address to listen for the HTTP server\n(default to 127.0.0.1:8090)");
  command
    .PersistentFlags()
    .StringVar(
      state,
      "httpsAddr",
      "https",
      "",
      "unsupported PocketBase automatic HTTPS server address\n(use a reverse proxy such as Caddy, NGINX, or Traefik for TLS termination)",
    );

  return command;
}
