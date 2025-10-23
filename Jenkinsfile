pipeline {
    agent any

    environment {
        DOCKERHUB_PAT = credentials('dockerhub-pat')  // Secret Text ID for your PAT
        DOCKERHUB_USERNAME = "maderanx"              // Your Docker Hub username
        IMAGE = "bluegreen-node"
    }

    stages {

        stage('Checkout') {
            steps {
                git 'https://github.com/Maderanx/blue-green-app.git'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    docker.build("${IMAGE}:${BUILD_NUMBER}")
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                script {
                    // Login using Docker Hub PAT
                    sh "docker login -u ${DOCKERHUB_USERNAME} -p ${DOCKERHUB_PAT}"

                    // Tag and push the image
                    sh "docker tag ${IMAGE}:${BUILD_NUMBER} ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"
                    sh "docker push ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"
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
                    sh "docker run -d -p ${hostPort}:3000 --name ${newColor} -e COLOR=${newColor} ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"

                    // Wait for the container to start
                    sleep 5

                    // Simple health check
                    def health = sh(script: "curl -s http://localhost:${hostPort} | grep '${newColor}' || echo 'fail'", returnStdout: true).trim()

                    if (health.contains(newColor)) {
                        echo "✅ ${newColor} is healthy. Switching Nginx traffic..."

                        // Update nginx config to point to new container
                        if (active != 'none') {
                            sh "sed -i '' 's/${active}/${newColor}/' nginx/nginx.conf"
                        } else {
                            sh "sed -i '' 's/blue/${newColor}/' nginx/nginx.conf"
                        }

                        // Reload Nginx
                        sh "docker exec nginx nginx -s reload"

                        // Stop old container if it exists
                        if (active != 'none') {
                            sh "docker stop ${active} && docker rm ${active}"
                        }

                    } else {
                        echo "❌ Deployment failed. Keeping ${active} live."
                        sh "docker stop ${newColor} && docker rm ${newColor}"
                        error("Deployment failed")
                    }
                }
            }
        }
    }
}
