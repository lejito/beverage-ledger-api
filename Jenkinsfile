pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
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

    stage('Pruebas (unitarias, regresión)') {
      steps {
        sh 'pnpm test:coverage --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml'
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'reports/junit.xml'
          archiveArtifacts artifacts: 'coverage/lcov.info', allowEmptyArchive: true
        }
      }
    }

    stage('Compilación') {
      steps { sh 'pnpm build' }
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
