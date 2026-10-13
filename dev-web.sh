#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
state_root="${XDG_STATE_HOME:-${HOME}/.local/state}"
state_dir="$state_root/mindzjweb-dev"
pid_file="$state_dir/dev-web.pid"
log_file="$state_dir/dev-web.log"

is_running() {
  [[ -f "$pid_file" ]] && kill -0 "$(<"$pid_file")" 2>/dev/null
}

show_urls() {
  local vite_port="${VITE_PORT:-3000}"
  local api_port="${MINDZJ_PORT:-1430}"
  local ips=""
  local address=""
  local authority=""
  local addresses=()

  ips="$(hostname -I 2>/dev/null || true)"
  read -r -a addresses <<< "$ips"
  printf 'WorkspaceWeb: https://localhost:%s/\n' "$vite_port"
  for address in "${addresses[@]}"; do
    [[ "$address" == 127.* || "$address" == ::1 ]] && continue
    authority="$address"
    [[ "$address" == *:* ]] && authority="[$address]"
    printf 'Network:   https://%s:%s/\n' "$authority" "$vite_port"
  done
  printf 'Rust API:  http://%s:%s\n' "${MINDZJ_BIND:-0.0.0.0}" "$api_port"
}

stop_server() {
  if ! is_running; then
    rm -f "$pid_file"
    printf 'WorkspaceWeb development servers are not running.\n'
    return 0
  fi

  local pid
  pid="$(<"$pid_file")"
  kill -TERM "$pid" 2>/dev/null || true
  for _ in {1..50}; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.1
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL "$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
  printf 'WorkspaceWeb development servers stopped.\n'
}

case "${1:-start}" in
  start)
    if is_running; then
      printf 'WorkspaceWeb development servers are already running (PID %s).\n' "$(<"$pid_file")"
      show_urls
      printf 'Logs: %s\n' "$log_file"
      exit 0
    fi

    mkdir -p "$state_dir"
    rm -f "$pid_file"
    nohup setsid "$repo_root/dev-web.sh" --run "$pid_file" </dev/null >>"$log_file" 2>&1 &
    launch_pid=$!

    for _ in {1..50}; do
      if is_running; then
        printf 'WorkspaceWeb development servers started in the background (PID %s).\n' "$(<"$pid_file")"
        show_urls
        printf 'Logs: %s (view with: %s logs)\n' "$log_file" "$0"
        printf 'Stop with: %s stop\n' "$0"
        exit 0
      fi
      if ! kill -0 "$launch_pid" 2>/dev/null; then
        break
      fi
      sleep 0.1
    done

    printf 'Could not start WorkspaceWeb. Recent log output:\n' >&2
    tail -n 40 "$log_file" >&2 || true
    exit 1
    ;;
  stop)
    stop_server
    ;;
  status)
    if is_running; then
      printf 'WorkspaceWeb development servers are running (PID %s).\n' "$(<"$pid_file")"
      show_urls
      printf 'Logs: %s\n' "$log_file"
    else
      rm -f "$pid_file"
      printf 'WorkspaceWeb development servers are not running.\n'
      exit 1
    fi
    ;;
  logs)
    mkdir -p "$state_dir"
    touch "$log_file"
    tail -n 100 -f "$log_file"
    ;;
  --run)
    pid_file="${2:?missing pid file}"
    cd "$repo_root"

    for tool in cargo npm setsid; do
      if ! command -v "$tool" >/dev/null 2>&1; then
        printf 'Required command not found: %s\n' "$tool" >&2
        exit 1
      fi
    done

    export MINDZJ_BIND="${MINDZJ_BIND:-0.0.0.0}"
    export MINDZJ_PORT="${MINDZJ_PORT:-1430}"
    export MINDZJ_API_TARGET="${MINDZJ_API_TARGET:-http://127.0.0.1:${MINDZJ_PORT}}"
    vite_port="${VITE_PORT:-3000}"

    printf '%s\n' "$$" >"$pid_file"
    api_pid=""
    vite_pid=""
    cleanup() {
      trap - EXIT INT TERM
      [[ -n "$api_pid" ]] && kill -TERM -- "-$api_pid" 2>/dev/null || true
      [[ -n "$vite_pid" ]] && kill -TERM -- "-$vite_pid" 2>/dev/null || true
      [[ -n "$api_pid" ]] && wait "$api_pid" 2>/dev/null || true
      [[ -n "$vite_pid" ]] && wait "$vite_pid" 2>/dev/null || true
      if [[ -f "$pid_file" && "$(<"$pid_file")" == "$$" ]]; then
        rm -f "$pid_file"
      fi
    }
    trap cleanup EXIT INT TERM

    setsid cargo run -p mindzj --bin mindzj-server &
    api_pid=$!
    setsid npm run dev -- --host 0.0.0.0 --port "$vite_port" --strictPort &
    vite_pid=$!
    wait -n "$api_pid" "$vite_pid"
    ;;
  *)
    printf 'Usage: %s [start|stop|status|logs]\n' "$0" >&2
    exit 2
    ;;
esac
