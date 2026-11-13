pipeline {
    agent any

    tools {
        nodejs '22'
        git 'Default'
    }
    parameters {
        string(name: 'VERSION', defaultValue: 'patch', description: 'patch | minor | major, or an exact version like 2.1.0')
        string(name: 'BRANCH', defaultValue: 'master', description: 'The branch to increment')
        booleanParam(name: 'CREATE_TAG', defaultValue: true, description: 'Check this to create and push a git tag')
    }
    stages {
        stage('Checkout') {
            steps {
                git branch: params.BRANCH, credentialsId: 'githubDiablade', url: 'https://github.com/diablade/geconomicus.git'
            }
        }
        stage('Update package version') {
            steps {
                sh "npm version ${params.VERSION} --no-git-tag-version --package-lock-only -w front -w back"
                script {
                    env.NEW_VERSION = sh(script: "node -p \"require('./back/package.json').version\"", returnStdout: true).trim()
                }
                echo "New version: ${env.NEW_VERSION}"
            }
        }
        stage('Update .env version') {
            steps {
                sh "sed -i 's/^GECO_VERSION=.*/GECO_VERSION=${env.NEW_VERSION}/' back/.env"
            }
        }
        stage('Commit, Tag and Push') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'githubDiablade', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                    sh '''
                        git config user.email "diablade@hotmail.com"
                        git config user.name "Jenkins"
                        git remote set-url origin https://${PASSWORD}@github.com/diablade/geconomicus.git
                        git commit -am "Update version to ${NEW_VERSION}"
                        git push origin HEAD:refs/heads/${BRANCH}
                    '''
                    script {
                        if (params.CREATE_TAG) {
                            sh '''
                                git tag v${NEW_VERSION}
                                git push origin v${NEW_VERSION}
                            '''
                            echo "✅ Tag v${env.NEW_VERSION} created and pushed"
                        } else {
                            echo "⏭️ Tag creation skipped"
                        }
                    }
                }
            }
        }
    }
}
