pipeline {
    agent any

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
        IMAGE = "maderanx/bluegreen-node"
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
                    docker.withRegistry('https://registry.hub.docker.com', 'dockerhub-creds') {
                        docker.image("${IMAGE}:${BUILD_NUMBER}").push()
                    }
                }
            }
        }

        stage('Blue-Green Deployment') {
            steps {
                script {
                    // Detect currently active container (blue or green)
                    def active = sh(script: "curl -s http://localhost:8081 | grep -o 'blue\\|green' || echo 'none'", returnStdout: true).trim()
                    def newColor = (active == 'blue') ? 'green' : 'blue'

                    echo "Active: ${active}, Deploying new version as: ${newColor}"

                    // Run new container
                    sh "docker run -d -p ${newColor == 'blue' ? '3000' : '3001'}:3000 --name ${newColor} -e COLOR=${newColor} ${IMAGE}:${BUILD_NUMBER}"

                    // Wait a few seconds for health check
                    sleep 5

                    // Simple health check
                    def health = sh(script: "curl -s http://localhost:${newColor == 'blue' ? '3000' : '3001'} | grep '${newColor}' || echo 'fail'", returnStdout: true).trim()

                    if (health.contains(newColor)) {
                        echo "✅ ${newColor} is healthy. Switching Nginx traffic..."
                        sh "sed -i '' 's/${active}/${newColor}/' nginx/nginx.conf"
                        sh "docker exec nginx nginx -s reload"

                        // Stop old container
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
