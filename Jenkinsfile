pipeline {
    agent any

    environment {
        DOCKERHUB_PAT = credentials('dockerhub-pat')
        DOCKERHUB_USERNAME = "maderanx"
        IMAGE = "bluegreen-node"
        NETWORK = "bluegreen-net"
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

        stage('Blue-Green Deployment') {
            steps {
                script {
                    // Create network if missing
                    sh "docker network inspect ${NETWORK} >/dev/null 2>&1 || docker network create ${NETWORK}"

                    // Detect active color from nginx.conf or default to none
                    def active = sh(script: "grep -oE 'upstream app_cluster {[^}]+server (blue|green)' nginx/nginx.conf | grep -oE '(blue|green)' | tail -n1 || echo 'none'", returnStdout: true).trim()
                    def newColor = (active == 'blue') ? 'green' : 'blue'
                    echo "🟢 Active container: ${active}. Deploying new version as: ${newColor}"

                    // Stop & remove old container of same color
                    sh """
                        if docker ps -a --format '{{.Names}}' | grep -w ${newColor}; then
                            echo "🧹 Removing old ${newColor} container..."
                            docker stop ${newColor} || true
                            docker rm ${newColor} || true
                        fi
                    """

                    // Deploy new app container on shared network
                    sh """
                        docker run -d --name ${newColor} --network ${NETWORK} \
                        -e COLOR=${newColor} ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}
                    """

                    // Health check
                    sleep 5
                    def health = sh(script: "docker exec ${newColor} curl -s http://localhost:3000 | grep '${newColor}' || echo 'fail'", returnStdout: true).trim()
                    if (!health.contains(newColor)) {
                        error("❌ ${newColor} failed health check.")
                    }

                    echo "✅ ${newColor} container healthy."

                    // Ensure Nginx exists
                    def nginxExists = sh(script: "docker ps -a --format '{{.Names}}' | grep -w nginx || true", returnStdout: true).trim()
                    if (!nginxExists) {
                        echo "🚀 Starting fresh Nginx container..."
                        sh """
                            docker run -d --name nginx -p 8081:80 \
                            -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf \
                            --network ${NETWORK} nginx:latest
                        """
                        sleep 3
                    } else {
                        echo "🔁 Reusing existing Nginx container."
                    }

                    // Update Nginx config to point to newColor
                    echo "📝 Updating nginx.conf to point to ${newColor}..."
                    sh """
                        if [ "${active}" != "none" ]; then
                            sed -i '' 's/${active}/${newColor}/' nginx/nginx.conf 2>/dev/null || sed -i 's/${active}/${newColor}/' nginx/nginx.conf
                        else
                            sed -i '' 's/blue/${newColor}/' nginx/nginx.conf 2>/dev/null || sed -i 's/blue/${newColor}/' nginx/nginx.conf
                        fi
                    """

                    // Reload or restart Nginx
                    echo "♻️ Reloading Nginx..."
                    sh """
                        docker exec nginx nginx -t && docker exec nginx nginx -s reload || \
                        (echo 'Nginx reload failed. Restarting...' && docker restart nginx)
                    """

                    // Remove old color container
                    if (active != 'none') {
                        sh "docker stop ${active} || true"
                        sh "docker rm ${active} || true"
                        echo "🧼 Old container ${active} stopped and removed."
                    }

                    echo "✅ Deployment switched to ${newColor}."
                }
            }
        }
    }

    post {
        always {
            echo "📋 Listing all containers:"
            sh "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
        }
        success {
            echo "🎉 Blue-Green deployment successful!"
        }
        failure {
            echo "❌ Deployment failed. Please check Jenkins logs."
        }
    }
}
