pipeline {
    agent {
        label 'gecoovh'
    }
    options {
        skipDefaultCheckout()
    }
    parameters {
        string(name: 'branch', defaultValue: 'master', description: 'the branch to checkout')
    }
    stages {
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "refs/heads/${params.branch}"]],
                    userRemoteConfigs: [[url: 'https://github.com/diablade/geconomicus.git']]
                ])
            }
        }
        stage('BuildShared') {
            steps {
                dir('shared') {
                    sh 'npm install'
                    sh 'npm run build'
                }
            }
        }
        stage('Deploy') {
            steps {
                withCredentials([file(credentialsId: 'QaGeco.env', variable: 'QA_ENV_FILE')]) {
                    sh '''
                        umask 077
                        grep -v '^GECO_VERSION=' "$QA_ENV_FILE" > .env
                        grep '^GECO_VERSION=' back/.env >> .env
                    '''
                }
                sh 'echo "Version déployée:" && grep GECO_VERSION .env'
                sh 'docker compose -p geco-qa -f geco-qa.yaml build'
                sh 'docker compose -p geco-qa -f geco-qa.yaml down --remove-orphans'
                sh 'docker compose -p geco-qa -f geco-qa.yaml up -d'
            }
        }
    }
    post {
        always {
            sh 'rm -f .env'
            sh 'docker image prune -f && docker builder prune -f'
        }
    }
}
