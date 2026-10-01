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
    stage('Install') {
      steps {
        sh 'pnpm install --frozen-lockfile'
        // src/generated is gitignored and several tests import its enums as
        // values; postinstall covers it, but its failure is quiet.
        sh 'pnpm db:generate'
      }
    }

    stage('Static checks') {
      parallel {
        stage('Lint') {
          steps { sh 'pnpm lint' }
        }
        stage('Typecheck') {
          steps { sh 'pnpm typecheck' }
        }
        stage('Format') {
          steps { sh 'pnpm format:check' }
        }
      }
    }

    stage('Test') {
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

    stage('Build') {
      steps { sh 'pnpm build' }
    }

    stage('SonarQube') {
      steps {
        // The server comes from SONAR_HOST_URL, set on the Jenkins controller.
        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
          sh 'pnpm dlx @sonar/scan'
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
