// Ported from pocketbase/cmd/serve.go

import type { App } from "../core/app.ts";
import { serve } from "../apis/serve.ts";
import { Command } from "../tools/cli/command.ts";

export function NewServeCommand(app: App, showStartBanner: boolean): Command {
  const state = {
    allowedOrigins: ["*"],
    httpAddr: "",
    httpsAddr: "",
  };

  const command = new Command({
    Use: "serve [domain(s)]",
    Short: "Starts the web server (default to 127.0.0.1:8090 if no domain is specified)",
    SilenceUsage: true,
  });

  command.RunE = (_cmd, args) => {
    if (args.length > 0) {
      if (!state.httpAddr) {
        state.httpAddr = "0.0.0.0:80";
      }
      if (!state.httpsAddr) {
        state.httpsAddr = "0.0.0.0:443";
      }
    } else if (!state.httpAddr) {
      state.httpAddr = "127.0.0.1:8090";
    }

    try {
      serve(app, {
        httpAddr: state.httpAddr,
        httpsAddr: state.httpsAddr,
        showStartBanner,
        allowedOrigins: state.allowedOrigins,
        certificateDomains: args,
      });
      return null;
    } catch (err) {
      return err as Error;
    }
  };

  command.PersistentFlags().StringSliceVar(state, "allowedOrigins", "origins", ["*"], "CORS allowed domain origins list");
  command
    .PersistentFlags()
    .StringVar(
      state,
      "httpAddr",
      "http",
      "",
      "TCP address to listen for the HTTP server\n(if domain args are specified - default to 0.0.0.0:80, otherwise - default to 127.0.0.1:8090)",
    );
  command
    .PersistentFlags()
    .StringVar(
      state,
      "httpsAddr",
      "https",
      "",
      "TCP address to listen for the HTTPS server\n(if domain args are specified - default to 0.0.0.0:443, otherwise - default to empty string, aka. no TLS)\nThe incoming HTTP traffic also will be auto redirected to the HTTPS version",
    );

  return command;
}
