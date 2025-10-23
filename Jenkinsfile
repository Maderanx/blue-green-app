pipeline {
    agent any

    environment {
        DOCKERHUB_PAT = 'dckr_pat_Xjc81YvcXUO6NiN3GYb6frXb8bA'  // Your Docker Hub PAT
        DOCKERHUB_USERNAME = "maderanx"                        // Your Docker Hub username
        IMAGE = "bluegreen-node"
        DOCKER_BUILDKIT = "0"                                   // Disable BuildKit
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
                    sh "/usr/local/bin/docker login -u ${DOCKERHUB_USERNAME} -p ${DOCKERHUB_PAT}"
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    sh "/usr/local/bin/docker build -t ${IMAGE}:${BUILD_NUMBER} ."
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                script {
                    sh "/usr/local/bin/docker tag ${IMAGE}:${BUILD_NUMBER} ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"
                    sh "/usr/local/bin/docker push ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"
                }
            }
        }

        stage('Blue-Green Deployment') {
            steps {
                script {
                    // Detect currently active container (blue or green)
                    def active = sh(script: "curl -s http://localhost:8081 | grep -o 'blue\\|green' || echo 'none'", returnStdout: true).trim()
                    def newColor = (active == 'blue') ? 'green' : 'blue'

                    echo "Active container: ${active}. Deploying new version as: ${newColor}"

                    // Run the new container
                    def hostPort = (newColor == 'blue') ? '3000' : '3001'
                    sh "/usr/local/bin/docker run -d -p ${hostPort}:3000 --name ${newColor} -e COLOR=${newColor} ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"

                    // Wait for container to start
                    sleep 5

                    // Health check
                    def health = sh(script: "curl -s http://localhost:${hostPort} | grep '${newColor}' || echo 'fail'", returnStdout: true).trim()

                    if (health.contains(newColor)) {
                        echo "✅ ${newColor} is healthy. Switching Nginx traffic..."

                        // Update nginx config
                        if (active != 'none') {
                            sh "sed -i '' 's/${active}/${newColor}/' nginx/nginx.conf"
                        } else {
                            sh "sed -i '' 's/blue/${newColor}/' nginx/nginx.conf"
                        }

                        // Reload Nginx
                        sh "/usr/local/bin/docker exec nginx nginx -s reload"

                        // Stop old container
                        if (active != 'none') {
                            sh "/usr/local/bin/docker stop ${active} && /usr/local/bin/docker rm ${active}"
                        }

                    } else {
                        echo "❌ Deployment failed. Keeping ${active} live."
                        sh "/usr/local/bin/docker stop ${newColor} && /usr/local/bin/docker rm ${newColor}"
                        error("Deployment failed")
                    }
                }
            }
        }
    }
}
