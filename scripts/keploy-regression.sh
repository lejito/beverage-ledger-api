#!/usr/bin/env bash
# Keploy regression: records the API at an earlier commit (default HEAD~1) with
# the traffic in scripts/keploy-traffic.mjs, then replays it against the working
# tree with Postgres answered from the recorded mocks. An answer that changed
# between the two versions is a failed test.
#
# Shared by GitHub Actions and Jenkins. It needs Linux with eBPF, root for keploy
# (KEPLOY_SUDO=sudo when the shell is not root), Node with
# corepack, keploy on the PATH, and an empty Postgres in DATABASE_URL/DIRECT_URL.
set -euo pipefail

base_ref="${1:-HEAD~1}"
sudo_prefix="${KEPLOY_SUDO:-}"
root="$(git rev-parse --show-toplevel)"
base_dir="$(mktemp -d)/base"

# Throwaway: the database dies with the run, so the recordings uploaded at the
# end never hold a credential that works anywhere. A caller that masks them in
# its logs (Actions) generates them first.
for name in JWT_SECRET CI_ADMIN_PASSWORD CI_MANAGER_PASSWORD CI_OPERATOR_PASSWORD; do
  if [ -z "${!name:-}" ]; then
    export "$name=Ci-$(node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))")-Kp1"
  fi
done
export CI_ADMIN_EMAIL="${CI_ADMIN_EMAIL:-ci.admin@beverageledger.test}"
export CI_MANAGER_EMAIL="${CI_MANAGER_EMAIL:-ci.manager@beverageledger.test}"
export CI_OPERATOR_EMAIL="${CI_OPERATOR_EMAIL:-ci.operator@beverageledger.test}"

git worktree add --detach "$base_dir" "$(git rev-parse "$base_ref")"
trap 'git -C "$root" worktree remove --force "$base_dir" || true' EXIT

# What the app needs, handed to keploy by name: sudo-rs, the sudo on current
# Ubuntu runners, ignores -E, and the app would start without its database.
keploy_env=(PATH="$PATH" DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DIRECT_URL" JWT_SECRET="$JWT_SECRET")

echo "== Versión grabada: $(git -C "$base_dir" log -1 --format='%h %s')"
(
  cd "$base_dir"
  pnpm install --frozen-lockfile
  pnpm db:generate
  # A database that has just started may refuse the first connections.
  for attempt in $(seq 1 30); do
    pnpm db:deploy && break
    [ "$attempt" -eq 30 ] && exit 1
    sleep 2
  done
  SEED_CI_ADMIN_PASSWORD="$CI_ADMIN_PASSWORD" \
  SEED_CI_MANAGER_PASSWORD="$CI_MANAGER_PASSWORD" \
  SEED_CI_OPERATOR_PASSWORD="$CI_OPERATOR_PASSWORD" \
    pnpm db:seed
  pnpm build
)

# keploy.yaml and the traffic script are the working tree's: the base may predate them.
echo "== Grabando el tráfico de RF-01, 03, 06, 09, 29 y 30"
cd "$base_dir"
$sudo_prefix env "${keploy_env[@]}" keploy record --config-path "$root" --path "$root" -c "node dist/main" \
  > "$root/keploy-record.log" 2>&1 &
recorder=$!
cd "$root"
node "$root/scripts/keploy-traffic.mjs"
sleep 5
# By pid, not by pattern: a pgrep for "keploy record" also finds its own command line.
# Under sudo the pid is sudo's, which passes the signal on to keploy.
$sudo_prefix kill -INT "$recorder"
wait "$recorder" || true
tail -5 "$root/keploy-record.log"

echo "== Reproduciendo contra la copia de trabajo"
cd "$root"
# Already done by the caller in Actions; a no-op then. Jenkins' sibling starts bare.
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
$sudo_prefix env "${keploy_env[@]}" keploy test -c "node dist/main"
