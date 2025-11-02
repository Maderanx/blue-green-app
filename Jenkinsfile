pipeline {
    agent any

    environment {
        DOCKERHUB_PAT = credentials('dockerhub-pat')
        DOCKERHUB_USERNAME = "maderanx"
        IMAGE = "bluegreen-node"
        DOCKER_BUILDKIT = "0"
        PATH = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        SHELL = "/bin/bash"
    }

    stages {

        stage('Checkout') {
            steps {
                git 'https://github.com/Maderanx/blue-green-app.git'
            }
        }

        stage('Docker Login') {
            steps {
                script {
                    sh "echo ${DOCKERHUB_PAT} | docker login -u ${DOCKERHUB_USERNAME} --password-stdin"
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    sh "docker build -t ${IMAGE}:${BUILD_NUMBER} ."
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                script {
                    sh "docker tag ${IMAGE}:${BUILD_NUMBER} ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"
                    sh "docker push ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"
                }
            }
        }

        stage('Blue-Green Deployment (No Nginx)') {
            steps {
                script {
                    // Detect currently active color
                    def active = sh(script: "curl -s http://localhost:3000 | grep -o 'blue\\|green' || curl -s http://localhost:3001 | grep -o 'blue\\|green' || echo 'none'", returnStdout: true).trim()
                    def newColor = (active == 'blue') ? 'green' : 'blue'
                    def newPort = (newColor == 'blue') ? 3000 : 3001

                    echo "🟢 Active container: ${active}. Deploying new version as: ${newColor} on port ${newPort}"

                    // Stop and remove previous container of same color if exists
                    sh """
                    if docker ps -a --format '{{.Names}}' | grep -w ${newColor}; then
                        echo "🧹 Removing old ${newColor} container..."
                        docker stop ${newColor} || true
                        docker rm ${newColor} || true
                    fi
                    """

                    // Run new container
                    sh """
                        docker run -d -p ${newPort}:3000 \
                        --name ${newColor} \
                        -e COLOR=${newColor} \
                        ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}
                    """

                    // Health check
                    sleep 5
                    def health = sh(script: "curl -s http://localhost:${newPort} | grep '${newColor}' || echo 'fail'", returnStdout: true).trim()

                    if (health.contains(newColor)) {
                        echo "✅ ${newColor} container healthy on port ${newPort}"

                        // Stop the old container if it exists
                        if (active != 'none') {
                            echo "🧼 Stopping and removing old container: ${active}"
                            sh "docker stop ${active} || true"
                            sh "docker rm ${active} || true"
                        }

                        echo "🎉 Traffic switched to ${newColor} on port ${newPort}"

                    } else {
                        echo "❌ ${newColor} failed health check. Rolling back..."
                        sh "docker stop ${newColor} || true"
                        sh "docker rm ${newColor} || true"
                        error("Deployment failed. Rolled back.")
                    }
                }
            }
        }
    }

    post {
        always {
            echo "📋 Listing containers..."
            sh "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
        }
        success {
            echo "🚀 Blue-Green deployment completed successfully without Nginx."
        }
        failure {
            echo "⚠️ Deployment failed. Check logs for details."
        }
    }
}
