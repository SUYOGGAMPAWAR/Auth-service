// ═══════════════════════════════════════════════════════════════
//  Jenkinsfile — JWT Auth Service CI/CD Pipeline
// ═══════════════════════════════════════════════════════════════

pipeline {
    agent any

    tools { nodejs 'NodeJS-20' }

    environment {
        APP_NAME        = 'jwt-auth-service'
        DOCKER_REGISTRY = 'your-dockerhub-username'
        IMAGE_NAME      = "${DOCKER_REGISTRY}/${APP_NAME}"
        IMAGE_TAG       = "${env.BUILD_NUMBER}"
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
    }

    parameters {
        choice(name: 'DEPLOY_ENV',  choices: ['dev', 'prod'],  description: 'Deployment environment')
        booleanParam(name: 'SKIP_TESTS',  defaultValue: false, description: 'Skip test stage')
        booleanParam(name: 'PUSH_IMAGE',  defaultValue: false, description: 'Push image to Docker Hub')
    }

    stages {

        stage('Checkout') {
            steps {
                echo "📥 Checking out branch: ${env.BRANCH_NAME ?: 'main'}"
                checkout scm
                script {
                    env.GIT_AUTHOR  = sh(returnStdout: true, script: "git log -1 --format='%an'").trim()
                    env.GIT_MESSAGE = sh(returnStdout: true, script: "git log -1 --format='%s'").trim()
                    echo "Author  : ${env.GIT_AUTHOR}"
                    echo "Commit  : ${env.GIT_MESSAGE}"
                }
            }
        }

        stage('Install') {
            steps {
                dir('app') {
                    echo "📦 Installing dependencies..."
                    sh 'npm install'
                }
            }
        }

        stage('Lint') {
            steps {
                dir('app') {
                    echo "🔍 Checking syntax..."
                    sh 'node --check src/index.js && echo "✅ Syntax OK"'
                    sh 'node --check src/controllers/auth.controller.js && echo "✅ Auth controller OK"'
                    sh 'node --check src/models/user.model.js && echo "✅ User model OK"'
                }
            }
        }

        stage('Test') {
            when { expression { !params.SKIP_TESTS } }
            steps {
                dir('app') {
                    echo "🧪 Running tests..."
                    sh 'npm run test:ci'
                }
            }
        }

        stage('Docker Build') {
            steps {
                echo "🐳 Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
                sh """
                    docker build \\
                        --build-arg BUILD_NUMBER=${BUILD_NUMBER} \\
                        --target production \\
                        -t ${IMAGE_NAME}:${IMAGE_TAG} \\
                        -t ${IMAGE_NAME}:latest \\
                        .
                """
            }
        }

        stage('Security Scan') {
            steps {
                echo "🔒 Scanning for vulnerabilities..."
                sh """
                    docker run --rm \\
                        -v /var/run/docker.sock:/var/run/docker.sock \\
                        aquasec/trivy:latest image \\
                        --exit-code 0 \\
                        --severity HIGH,CRITICAL \\
                        --no-progress \\
                        ${IMAGE_NAME}:${IMAGE_TAG} || true
                """
            }
        }

        stage('Push Image') {
            when { expression { params.PUSH_IMAGE } }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh """
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push ${IMAGE_NAME}:${IMAGE_TAG}
                        docker push ${IMAGE_NAME}:latest
                        docker logout
                    """
                }
            }
        }

        stage('Deploy') {
            when {
                allOf {
                    expression { params.PUSH_IMAGE }
                    anyOf { branch 'main'; branch 'master' }
                }
            }
            steps {
                script {
                    def envDir = params.DEPLOY_ENV
                    withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
                        sh """
                            sed -i 's|IMAGE_TAG_PLACEHOLDER|${IMAGE_TAG}|g' k8s/overlays/${envDir}/kustomization.yaml
                            kubectl apply -k k8s/overlays/${envDir}/
                            kubectl rollout status deployment/${APP_NAME} -n auth-${envDir} --timeout=120s
                            kubectl get pods -n auth-${envDir}
                        """
                    }
                }
            }
        }

    }

    post {
        always {
            script {
                try { sh "docker rmi ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest || true" }
                catch (err) { echo "Cleanup skipped: ${err.message}" }
            }
            cleanWs()
        }
        success { echo "✅ Pipeline #${BUILD_NUMBER} passed!" }
        failure { echo "❌ Pipeline #${BUILD_NUMBER} failed." }
    }
}
