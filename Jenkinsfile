// The CI members of the organization the deployed-API suites sign in as.
def ciAccounts() {
  return [
    usernamePassword(credentialsId: 'ci-admin', usernameVariable: 'CI_ADMIN_EMAIL', passwordVariable: 'CI_ADMIN_PASSWORD'),
    usernamePassword(credentialsId: 'ci-manager', usernameVariable: 'CI_MANAGER_EMAIL', passwordVariable: 'CI_MANAGER_PASSWORD'),
    usernamePassword(credentialsId: 'ci-operator', usernameVariable: 'CI_OPERATOR_EMAIL', passwordVariable: 'CI_OPERATOR_PASSWORD'),
    usernamePassword(credentialsId: 'ci-lockout', usernameVariable: 'CI_LOCKOUT_EMAIL', passwordVariable: 'CI_LOCKOUT_PASSWORD')
  ]
}

pipeline {
  agent any

  options {
    timestamps()
    // The deployed-API suites pace their logins to the API's rate limit, and may
    // wait for the web job to release the render-api lock first.
    timeout(time: 60, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    // prisma.config.ts resolves the datasource with `env('DIRECT_URL')`, which
    // throws when the variable is missing, and `prisma generate` runs from
    // postinstall. Nothing here connects, so a syntactically valid placeholder
    // is enough and no database credential belongs in CI.
    DIRECT_URL = 'postgresql://ci:ci@localhost:5432/ci'
    DATABASE_URL = 'postgresql://ci:ci@localhost:5432/ci'
    CI = 'true'
    // The deployed API the API and security suites call. The same credential
    // the web job builds against.
    API_URL = credentials('next-public-api-url')
  }

  stages {
    stage('Instalación de dependencias') {
      steps {
        sh 'pnpm install --frozen-lockfile'
        // src/generated is gitignored and several tests import its enums as
        // values; postinstall covers it, but its failure is quiet.
        sh 'pnpm db:generate'
      }
    }

    stage('Revisión estática') {
      steps {
        sh 'pnpm lint'
        sh 'pnpm typecheck'
        sh 'pnpm format:check'
        // Production dependencies only: dev tooling never reaches Render. Here and
        // not with the security suite, which runs after the deploy.
        sh 'pnpm audit --prod --audit-level high'
      }
    }

    stage('Pruebas unitarias') {
      steps {
        sh 'pnpm test:unit --coverage --coverage.reportsDirectory=coverage/unit --reporter=default --reporter=junit --outputFile.junit=reports/unit.xml'
      }
      post {
        always { junit allowEmptyResults: true, testResults: 'reports/unit.xml' }
      }
    }

    stage('Compilación') {
      steps { sh 'pnpm build' }
    }

    stage('Pruebas de regresión') {
      stages {
        stage('Funcionales') {
          steps {
            sh 'pnpm test:funcional --coverage --coverage.reportsDirectory=coverage/funcional --reporter=default --reporter=junit --outputFile.junit=reports/funcional.xml'
          }
          post {
            always { junit allowEmptyResults: true, testResults: 'reports/funcional.xml' }
          }
        }

        // Records the commit Jenkins built last (or the parent) and replays it
        // against this one with Postgres mocked: a changed answer blocks the
        // deploy. Keploy needs eBPF and root, so it runs in a privileged sibling
        // container next to a throwaway Postgres, through the Docker socket the
        // controller mounts; same procedure as Jenkinsfile.ia and ci.yml.
        stage('Keploy (captura y reproducción)') {
          environment {
            LAB = "keploy-${env.BUILD_TAG.replaceAll('[^A-Za-z0-9_.-]', '-').toLowerCase()}"
            KEPLOY_VERSION = 'v3.6.131'
            BASE = "${env.GIT_PREVIOUS_COMMIT ?: 'HEAD~1'}"
          }
          steps {
            sh '''
              docker network create "$LAB"
              docker run -d --name "$LAB-db" --network "$LAB" \
                -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=beverage_ledger \
                postgres:17-alpine
            '''
            sh '''
              docker run --rm --privileged --pid=host --network "$LAB" \
                -v /sys/kernel/debug:/sys/kernel/debug -v /sys/fs/bpf:/sys/fs/bpf \
                --volumes-from beverage-ledger-jenkins -w "$WORKSPACE" \
                -e BASE -e KEPLOY_VERSION -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
                -e DATABASE_URL="postgresql://postgres:postgres@$LAB-db:5432/beverage_ledger" \
                -e DIRECT_URL="postgresql://postgres:postgres@$LAB-db:5432/beverage_ledger" \
                node:22-bookworm bash -c '
                  trap "chown -R 1000:1000 \\"$PWD\\"" EXIT
                  set -e
                  git config --global --add safe.directory "*"
                  corepack enable
                  curl -sSfL "https://github.com/keploy/keploy/releases/download/$KEPLOY_VERSION/keploy_linux_amd64.tar.gz" \
                    | tar -xz -C /usr/local/bin keploy
                  git cat-file -e "$BASE^{commit}" 2>/dev/null || BASE=HEAD~1
                  bash scripts/keploy-regression.sh "$BASE"
                '
            '''
          }
          post {
            always {
              archiveArtifacts artifacts: 'keploy/**, keploy-record.log', allowEmptyArchive: true
              sh 'docker rm -f "$LAB-db" >/dev/null 2>&1 || true; docker network rm "$LAB" >/dev/null 2>&1 || true'
            }
          }
        }
      }
      post {
        always { archiveArtifacts artifacts: 'coverage/*/lcov.info', allowEmptyArchive: true }
      }
    }

    stage('Calidad (SonarQube)') {
      steps {
        // The server comes from SONAR_HOST_URL, set on the Jenkins controller.
        // qualitygate.wait fails the stage when the gate fails, so nothing below
        // it ships.
        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
          sh 'pnpm dlx @sonar/scan -Dsonar.qualitygate.wait=true'
        }
      }
    }

    stage('Despliegue') {
      // Render's auto-deploy is off (render.yaml): production moves only here,
      // after every stage above passed, and only from main.
      when { expression { env.GIT_BRANCH == 'origin/main' } }
      steps {
        // `ref` pins the deploy to the commit this build tested, not whatever
        // reached main while it ran. Render builds it and runs the migrations.
        withCredentials([string(credentialsId: 'render-deploy-hook', variable: 'RENDER_DEPLOY_HOOK')]) {
          sh 'curl --fail --silent --show-error -X POST "$RENDER_DEPLOY_HOOK&ref=$GIT_COMMIT"'
        }
        // The hook answers once the deploy is queued, not once it is live: the
        // stages below must not start against the version before it.
        timeout(time: 20, unit: 'MINUTES') {
          waitUntil(initialRecurrencePeriod: 15000, quiet: true) {
            script {
              def served = sh(
                script: '''curl --silent --max-time 20 "$API_URL/api/v1/health" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).commit||'')}catch{}})" || true''',
                returnStdout: true
              ).trim()
              return served && env.GIT_COMMIT.startsWith(served)
            }
          }
        }
      }
    }

    // After the deploy: they call the API on Render, which now serves this commit,
    // and write to its database through dedicated CI accounts. A failure no longer
    // stops the deploy, it reports a regression already in production. Off main
    // nothing is deployed, so they check what production serves. The lock keeps
    // this job and the web job from sharing the login rate limit at the same time.
    stage('Pruebas de regresión: API') {
      options { lock('render-api') }
      steps {
        withCredentials(ciAccounts()) {
          sh 'pnpm test:api --reporter=default --reporter=junit --outputFile.junit=reports/api.xml'
        }
      }
      post {
        always { junit allowEmptyResults: true, testResults: 'reports/api.xml' }
      }
    }

    stage('Pruebas de regresión: Seguridad') {
      options { lock('render-api') }
      steps {
        withCredentials(ciAccounts()) {
          sh 'pnpm test:seguridad --reporter=default --reporter=junit --outputFile.junit=reports/seguridad.xml'
        }
      }
      post {
        always { junit allowEmptyResults: true, testResults: 'reports/seguridad.xml' }
      }
    }
  }

  post {
    // A reused workspace keeps the last build's dist/, and Vitest would pick up
    // anything that looks like a test in there.
    cleanup { cleanWs() }
  }
}
