#!/usr/bin/env bash
# Local-only helper: run paired PocketBase/PocketBun upstream benchmark batches
# on a remote host and generate a local factor summary report.
set -euo pipefail

default_host="root@pocketbun.pekeler.org"
default_repo_dir="/opt/pocketbun"
default_results_root="benchmarks/results/batches"
default_tag="hetzner_ccx13"
default_runs=5
default_tail_lines=40

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
state_file="/tmp/pocketbun-bench-upstream-compare-last.env"
factor_script="${repo_root}/scripts/bench_upstream_factor_summary.js"

usage() {
  cat <<'EOF'
Usage:
  bench_upstream_compare_ssh.sh start [user@host] [options]
  bench_upstream_compare_ssh.sh status [user@host] [options]
  bench_upstream_compare_ssh.sh report [user@host] [options]

Commands:
  start   Start a detached tmux job on the remote host that runs:
          - `bun run bench:upstream` N times
          - `bun run bench:upstream:pocketbun` N times
          and writes a manifest with all generated file paths.
  status  Show tmux status, manifest content, and remote log tail.
  report  Fetch the completed batch results locally and generate a factor summary report.

Options (start):
  --repo-dir <path>        Remote repo directory (default: /opt/pocketbun)
  --results-root <path>    Remote results root relative to repo (default: benchmarks/results/batches)
  --tag <name>             Machine tag suffix (default: hetzner_ccx13)
  --runs <n>               Runs per system (default: 5)
  --session <name>         Optional tmux session name (default: auto-generated)
  --sync-benchmarks        Run `bun run upstream:sync:benchmarks` before benchmarks (default)
  --no-sync-benchmarks     Skip `upstream:sync:benchmarks`

Options (status):
  --session <name>         tmux session name (default: from last state)
  --manifest <path>        Remote manifest path (default: from last state or /tmp/<session>.manifest)
  --log <path>             Remote log path (default: from last state or /tmp/<session>.log)
  --tail <n>               Log tail lines (default: 40)

Options (report):
  --session <name>         tmux session name (default: from last state)
  --manifest <path>        Remote manifest path (default: from last state or /tmp/<session>.manifest)
  --local-dir <path>       Local output directory (default: benchmarks/results/<session>)
  --out <path>             Local markdown report path (default: <local-dir>/summary.md)

Examples:
  bash scripts/bench_upstream_compare_ssh.sh start
  bash scripts/bench_upstream_compare_ssh.sh status
  bash scripts/bench_upstream_compare_ssh.sh report
EOF
}

is_positive_int() {
  local value="${1:-}"
  [[ "${value}" =~ ^[1-9][0-9]*$ ]]
}

read_last_state() {
  if [[ -f "${state_file}" ]]; then
    # shellcheck disable=SC1090
    source "${state_file}"
  fi
}

write_state() {
  local host="$1"
  local session="$2"
  local repo_dir="$3"
  local results_root="$4"
  local tag="$5"
  local runs="$6"
  local manifest="$7"
  local log="$8"
  cat >"${state_file}" <<EOF
LAST_HOST=${host}
LAST_SESSION=${session}
LAST_REPO_DIR=${repo_dir}
LAST_RESULTS_ROOT=${results_root}
LAST_TAG=${tag}
LAST_RUNS=${runs}
LAST_MANIFEST=${manifest}
LAST_LOG=${log}
EOF
}

resolve_host() {
  local maybe_host="${1:-}"
  if [[ -n "${maybe_host}" && ( "${maybe_host}" == *"@"* || "${maybe_host}" == *"."* ) ]]; then
    printf "%s\n" "${maybe_host}"
  else
    printf "%s\n" "${default_host}"
  fi
}

parse_common_args() {
  # Outputs: "<host> <consumed>"
  local host_arg="${1:-}"
  local host
  host="$(resolve_host "${host_arg}")"
  if [[ "${host}" == "${host_arg}" && -n "${host_arg}" ]]; then
    echo "${host} 1"
  else
    echo "${host} 0"
  fi
}

start_cmd() {
  local host_info
  host_info="$(parse_common_args "${1:-}")"
  local host consumed
  host="${host_info% *}"
  consumed="${host_info##* }"
  shift "${consumed}"

  local repo_dir="${default_repo_dir}"
  local results_root="${default_results_root}"
  local tag="${default_tag}"
  local runs="${default_runs}"
  local session=""
  local sync_benchmarks=1

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo-dir)
        repo_dir="${2:?missing value for --repo-dir}"
        shift 2
        ;;
      --results-root)
        results_root="${2:?missing value for --results-root}"
        shift 2
        ;;
      --tag)
        tag="${2:?missing value for --tag}"
        shift 2
        ;;
      --runs)
        runs="${2:?missing value for --runs}"
        shift 2
        ;;
      --session)
        session="${2:?missing value for --session}"
        shift 2
        ;;
      --sync-benchmarks)
        sync_benchmarks=1
        shift
        ;;
      --no-sync-benchmarks)
        sync_benchmarks=0
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done

  if ! is_positive_int "${runs}"; then
    echo "--runs must be a positive integer, got: ${runs}" >&2
    exit 1
  fi

  if [[ -z "${session}" ]]; then
    session="pb_compare_$(date -u +%Y%m%dT%H%M%SZ)"
  fi

  local log manifest runner
  log="/tmp/${session}.log"
  manifest="/tmp/${session}.manifest"
  runner="/tmp/${session}.runner.sh"

  local remote_cmd
  remote_cmd=$(cat <<'REMOTE'
set -euo pipefail
repo_dir="$1"
results_root="$2"
tag="$3"
runs="$4"
session="$5"
log="$6"
manifest="$7"
runner="$8"
sync_benchmarks="$9"

if ! command -v tmux >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y tmux
fi

results_rel="${results_root%/}/${session}"
results_abs="${repo_dir}/${results_rel}"
mkdir -p "${results_abs}"

if [[ "${sync_benchmarks}" == "1" ]]; then
  (
    cd "${repo_dir}"
    bun run upstream:sync:benchmarks
  )
fi

repo_q="$(printf '%q' "${repo_dir}")"
results_rel_q="$(printf '%q' "${results_rel}")"
results_abs_q="$(printf '%q' "${results_abs}")"
tag_q="$(printf '%q' "${tag}")"
runs_q="$(printf '%q' "${runs}")"
session_q="$(printf '%q' "${session}")"
manifest_q="$(printf '%q' "${manifest}")"

cat >"${runner}" <<EOF
#!/usr/bin/env bash
set -euo pipefail

repo_dir=${repo_q}
results_rel=${results_rel_q}
results_abs=${results_abs_q}
tag=${tag_q}
runs=${runs_q}
session=${session_q}
manifest=${manifest_q}

list_files() {
  local system="\$1"
  compgen -G "\${results_abs}/*-\${system}-upstream-\${tag}.md" | sort || true
}

latest_file() {
  local system="\$1"
  ls -1t "\${results_abs}"/*-"\${system}"-upstream-"\${tag}".md 2>/dev/null | head -n 1 || true
}

run_suite() {
  local system="\$1"
  local manifest_prefix="\$2"

  for i in \$(seq 1 "\${runs}"); do
    echo "[\${system}] run \${i}/\${runs} started"
    before="\$(mktemp)"
    after="\$(mktemp)"
    list_files "\${system}" >"\${before}"

    (
      cd "\${repo_dir}"
      export POCKETBUN_BENCH_MACHINE_TAG="\${tag}"
      export POCKETBUN_BENCH_RESULTS_DIR="\${results_rel}"
      if [[ "\${system}" == "pocketbase" ]]; then
        bun run bench:upstream
      else
        bun run bench:upstream:pocketbun
      fi
    )

    list_files "\${system}" >"\${after}"
    new_file="\$(comm -13 "\${before}" "\${after}" | tail -n 1 || true)"
    if [[ -z "\${new_file}" ]]; then
      new_file="\$(latest_file "\${system}")"
    fi
    if [[ -z "\${new_file}" || ! -f "\${new_file}" ]]; then
      echo "ERROR: failed to detect \${system} result file for run \${i}" >&2
      rm -f "\${before}" "\${after}"
      exit 1
    fi

    echo "\${manifest_prefix}_\${i}=\${new_file}" >>"\${manifest}"
    echo "[\${system}] run \${i}/\${runs} completed: \${new_file}"
    rm -f "\${before}" "\${after}"
  done
}

echo "SESSION=\${session}" >"\${manifest}"
echo "TAG=\${tag}" >>"\${manifest}"
echo "RUNS_PER_SYSTEM=\${runs}" >>"\${manifest}"
echo "REPO_DIR=\${repo_dir}" >>"\${manifest}"
echo "RESULTS_DIR=\${results_rel}" >>"\${manifest}"
echo "RESULTS_ABS=\${results_abs}" >>"\${manifest}"
echo "STARTED_AT=\$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"\${manifest}"

run_suite "pocketbase" "PB_RUN"
run_suite "pocketbun" "PBU_RUN"

echo "DONE=1" >>"\${manifest}"
echo "FINISHED_AT=\$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"\${manifest}"
EOF

chmod +x "${runner}"
tmux new-session -d -s "${session}" "bash '${runner}' > '${log}' 2>&1"

echo "SESSION=${session}"
echo "LOG=${log}"
echo "MANIFEST=${manifest}"
echo "RESULTS_DIR=${results_rel}"
echo "RUNS=${runs}"
REMOTE
)

  ssh "${host}" "bash -s -- $(printf '%q ' "${repo_dir}" "${results_root}" "${tag}" "${runs}" "${session}" "${log}" "${manifest}" "${runner}" "${sync_benchmarks}")" <<<"${remote_cmd}"

  write_state "${host}" "${session}" "${repo_dir}" "${results_root}" "${tag}" "${runs}" "${manifest}" "${log}"

  echo
  echo "Started detached comparison batch."
  echo "- host: ${host}"
  echo "- session: ${session}"
  echo "- runs per system: ${runs}"
  echo "- log: ${log}"
  echo "- manifest: ${manifest}"
  echo
  echo "Next commands:"
  echo "  bash scripts/bench_upstream_compare_ssh.sh status ${host} --session ${session}"
  echo "  bash scripts/bench_upstream_compare_ssh.sh report ${host} --session ${session}"
}

status_cmd() {
  read_last_state

  local host_info
  host_info="$(parse_common_args "${1:-}")"
  local host consumed
  host="${host_info% *}"
  consumed="${host_info##* }"
  shift "${consumed}"

  local session="${LAST_SESSION:-}"
  local manifest="${LAST_MANIFEST:-}"
  local log="${LAST_LOG:-}"
  local tail_lines="${default_tail_lines}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --session)
        session="${2:?missing value for --session}"
        shift 2
        ;;
      --manifest)
        manifest="${2:?missing value for --manifest}"
        shift 2
        ;;
      --log)
        log="${2:?missing value for --log}"
        shift 2
        ;;
      --tail)
        tail_lines="${2:?missing value for --tail}"
        shift 2
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done

  if [[ -z "${session}" ]]; then
    echo "No session specified and no previous state found." >&2
    exit 1
  fi
  if [[ -z "${manifest}" ]]; then
    manifest="/tmp/${session}.manifest"
  fi
  if [[ -z "${log}" ]]; then
    log="/tmp/${session}.log"
  fi
  if ! is_positive_int "${tail_lines}"; then
    echo "--tail must be a positive integer, got: ${tail_lines}" >&2
    exit 1
  fi

  ssh "${host}" "set -euo pipefail; if tmux has-session -t $(printf '%q' "${session}") 2>/dev/null; then echo STATUS=RUNNING; else echo STATUS=DONE; fi; echo SESSION=$(printf '%q' "${session}"); echo MANIFEST=$(printf '%q' "${manifest}"); echo LOG=$(printf '%q' "${log}"); echo '--- MANIFEST ---'; if [ -f $(printf '%q' "${manifest}") ]; then cat $(printf '%q' "${manifest}"); else echo '(manifest not found)'; fi; echo '--- LOG TAIL ---'; if [ -f $(printf '%q' "${log}") ]; then tail -n $(printf '%q' "${tail_lines}") $(printf '%q' "${log}"); else echo '(log not found)'; fi"
}

report_cmd() {
  read_last_state

  local host_info
  host_info="$(parse_common_args "${1:-}")"
  local host consumed
  host="${host_info% *}"
  consumed="${host_info##* }"
  shift "${consumed}"

  local session="${LAST_SESSION:-}"
  local manifest="${LAST_MANIFEST:-}"
  local local_dir=""
  local out_path=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --session)
        session="${2:?missing value for --session}"
        shift 2
        ;;
      --manifest)
        manifest="${2:?missing value for --manifest}"
        shift 2
        ;;
      --local-dir)
        local_dir="${2:?missing value for --local-dir}"
        shift 2
        ;;
      --out)
        out_path="${2:?missing value for --out}"
        shift 2
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done

  if [[ -z "${session}" ]]; then
    echo "No session specified and no previous state found." >&2
    exit 1
  fi
  if [[ -z "${manifest}" ]]; then
    manifest="/tmp/${session}.manifest"
  fi

  if [[ -z "${local_dir}" ]]; then
    local_dir="${repo_root}/benchmarks/results/${session}"
  fi
  if [[ -z "${out_path}" ]]; then
    out_path="${local_dir}/summary.md"
  fi

  local tmp_dir
  tmp_dir="$(mktemp -d "/tmp/${session}.report.XXXXXX")"
  trap 'rm -rf "${tmp_dir:-}"' EXIT

  ssh "${host}" "cat $(printf '%q' "${manifest}")" >"${tmp_dir}/manifest.env"
  # shellcheck disable=SC1090
  source "${tmp_dir}/manifest.env"

  if [[ "${DONE:-0}" != "1" ]]; then
    echo "Run is not complete yet (DONE=${DONE:-0})." >&2
    echo "Use status and run report again after completion." >&2
    exit 1
  fi

  local runs
  runs="${RUNS_PER_SYSTEM:-0}"
  if ! is_positive_int "${runs}"; then
    echo "Manifest has invalid RUNS_PER_SYSTEM: ${runs}" >&2
    exit 1
  fi

  mkdir -p "${local_dir}/raw"
  cp "${tmp_dir}/manifest.env" "${local_dir}/manifest.env"

  for i in $(seq 1 "${runs}"); do
    local pb_var pbu_var pb_remote pbu_remote pb_local pbu_local
    pb_var="PB_RUN_${i}"
    pbu_var="PBU_RUN_${i}"
    pb_remote="${!pb_var:-}"
    pbu_remote="${!pbu_var:-}"

    if [[ -z "${pb_remote}" || -z "${pbu_remote}" ]]; then
      echo "Manifest missing ${pb_var} or ${pbu_var}." >&2
      exit 1
    fi

    pb_local="${local_dir}/raw/$(basename "${pb_remote}")"
    pbu_local="${local_dir}/raw/$(basename "${pbu_remote}")"

    ssh "${host}" "cat $(printf '%q' "${pb_remote}")" >"${pb_local}"
    ssh "${host}" "cat $(printf '%q' "${pbu_remote}")" >"${pbu_local}"
  done

  if [[ ! -f "${factor_script}" ]]; then
    echo "Missing factor summary script: ${factor_script}" >&2
    exit 1
  fi

  local summary_output
  summary_output="$(bun "${factor_script}" --dir "${local_dir}/raw")"

  {
    echo "# PocketBase vs PocketBun Upstream Benchmark Batch Summary"
    echo
    echo "- generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "- host: ${host}"
    echo "- session: ${SESSION:-${session}}"
    echo "- machine tag: ${TAG:-unknown}"
    echo "- runs per system: ${runs}"
    echo "- remote repo: ${REPO_DIR:-unknown}"
    echo "- remote results dir: ${RESULTS_DIR:-unknown}"
    echo "- started: ${STARTED_AT:-unknown}"
    echo "- finished: ${FINISHED_AT:-unknown}"
    echo
    echo "## Run Files"
    echo
    echo "| System | Run | Remote File | Local File |"
    echo "| --- | ---: | --- | --- |"
    for i in $(seq 1 "${runs}"); do
      local pb_var pbu_var pb_remote pbu_remote pb_local pbu_local
      pb_var="PB_RUN_${i}"
      pbu_var="PBU_RUN_${i}"
      pb_remote="${!pb_var}"
      pbu_remote="${!pbu_var}"
      pb_local="${local_dir}/raw/$(basename "${pb_remote}")"
      pbu_local="${local_dir}/raw/$(basename "${pbu_remote}")"
      echo "| PocketBase | ${i} | \`${pb_remote}\` | \`${pb_local}\` |"
      echo "| PocketBun | ${i} | \`${pbu_remote}\` | \`${pbu_local}\` |"
    done
    echo
    echo "## Factor Summary"
    echo
    echo '```text'
    echo "${summary_output}"
    echo '```'
  } >"${out_path}"

  echo "Wrote summary report: ${out_path}"
  echo "Fetched raw files: ${local_dir}/raw"
}

main() {
  if [[ $# -lt 1 ]]; then
    usage
    exit 1
  fi

  local cmd="$1"
  shift

  case "${cmd}" in
    start)
      start_cmd "$@"
      ;;
    status)
      status_cmd "$@"
      ;;
    report)
      report_cmd "$@"
      ;;
    -h | --help)
      usage
      ;;
    *)
      echo "Unknown command: ${cmd}" >&2
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
