pipeline {
    agent {
        label 'gecoprod'
    }
    options {
        skipDefaultCheckout()
    }
    parameters {
        string(name: 'VERSION', defaultValue: '', description: 'the version to deploy, e.g. 2.0.1 (checks out tag v2.0.1)')
    }
    stages {
        stage('Checkout') {
            steps {
                script {
                    if (!(params.VERSION ==~ /\d+\.\d+\.\d+/)) {
                        error "VERSION must look like 2.0.1, got '${params.VERSION}'"
                    }
                }
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "refs/tags/v${params.VERSION}"]],
                    userRemoteConfigs: [[url: 'https://github.com/diablade/geconomicus.git', refspec: '+refs/tags/*:refs/remotes/origin/tags/*']]
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
                withCredentials([file(credentialsId: 'ProdGeco.env', variable: 'PROD_ENV_FILE')]) {
                    sh '''
                        umask 077
                        grep -v '^GECO_VERSION=' "$PROD_ENV_FILE" > .env
                        echo "GECO_VERSION=${VERSION}" >> .env
                    '''
                }
                sh 'echo "Version déployée:" && grep GECO_VERSION .env'
                sh 'docker compose -p geco-prod -f geco-prod.yaml build'
                sh 'docker compose -p geco-prod -f geco-prod.yaml up -d --remove-orphans'
            }
        }
    }
    post {
        success {
            sh '''
                docker images geconomicus-api --format '{{.Repository}}:{{.Tag}}' | grep -vxF "geconomicus-api:${VERSION}" | xargs -r docker rmi || true
            '''
        }
        always {
            sh 'rm -f .env'
            sh 'docker image prune -f && docker builder prune -f'
        }
    }
}
