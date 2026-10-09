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
        stage('Pruebas funcionales') {
          steps {
            sh 'pnpm test:funcional --coverage --coverage.reportsDirectory=coverage/funcional --reporter=default --reporter=junit --outputFile.junit=reports/funcional.xml'
          }
          post {
            always { junit allowEmptyResults: true, testResults: 'reports/funcional.xml' }
          }
        }

        // Both suites below run against the API deployed on Render and write to
        // its database through dedicated CI accounts. The lock keeps this job and
        // the web job from sharing the login rate limit at the same time.
        stage('Pruebas de API') {
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

        stage('Pruebas de seguridad') {
          options { lock('render-api') }
          steps {
            withCredentials(ciAccounts()) {
              sh 'pnpm test:seguridad --reporter=default --reporter=junit --outputFile.junit=reports/seguridad.xml'
            }
            // Production dependencies only: dev tooling never reaches Render.
            sh 'pnpm audit --prod --audit-level high'
          }
          post {
            always { junit allowEmptyResults: true, testResults: 'reports/seguridad.xml' }
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
      }
    }
  }

  post {
    // A reused workspace keeps the last build's dist/, and Vitest would pick up
    // anything that looks like a test in there.
    cleanup { cleanWs() }
  }
}
