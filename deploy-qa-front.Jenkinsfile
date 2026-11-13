pipeline {
    agent {
        label 'master'
    }
    options {
        skipDefaultCheckout()
    }
    parameters {
        string(name: 'branch', defaultValue: 'master', description: 'the branch to checkout')
    }
    tools {
        nodejs '22'
        git 'Default'
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
        stage('BuildFront') {
            steps {
                dir('front') {
                    sh 'npm install'
                    sh 'npm run build-qa'
                    sh 'ls -la dist/front'
                }
            }
        }
        stage('Deploy') {
            steps {
                ftpPublisher alwaysPublishFromMaster: true,
                    continueOnError: true,
                    failOnError: true,
                    publishers: [
                        [
                            configName: 'devGecoFTP',
                            transfers: [
                                [
                                    asciiMode: false,
                                    cleanRemote: true,
                                    excludes: 'clear-cache.php',
                                    flatten: false,
                                    makeEmptyDirs: true,
                                    noDefaultExcludes: false,
                                    patternSeparator: '[, ]+',
                                    remoteDirectory: '/www',
                                    remoteDirectorySDF: false,
                                    removePrefix: 'front/dist/front/',
                                    sourceFiles: 'front/dist/front/**'
                                ]
                            ]
                        ]
                    ]
            }
        }
    }
}
