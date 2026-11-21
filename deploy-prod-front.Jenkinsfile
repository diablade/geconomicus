pipeline {
    agent {
        label 'master'
    }
    options {
        skipDefaultCheckout()
    }
    parameters {
        string(name: 'VERSION', defaultValue: '', description: 'the version to deploy, e.g. 2.1.0 (checks out tag v2.1.0)')
    }
    tools {
        nodejs '22'
        git 'Default'
    }
    stages {
        stage('Checkout') {
            steps {
                script {
                    if (!(params.VERSION ==~ /\d+\.\d+\.\d+/)) {
                        error "VERSION must look like 2.1.0, got '${params.VERSION}'"
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
        stage('BuildFront') {
            steps {
                dir('front') {
                    sh 'npm install'
                    sh 'npm run build-prod'
                }
            }
        }
        stage('Deploy') {
            steps {
                script {
                    ftpPublisher alwaysPublishFromMaster: true,
                        continueOnError: false,
                        failOnError: true,
                        publishers: [
                            [
                                configName: 'prodGecoFTP',
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
}
