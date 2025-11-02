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
                    sh "echo ${DOCKERHUB_PAT} | /usr/local/bin/docker login -u ${DOCKERHUB_USERNAME} --password-stdin"
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
                    // Determine active color
                    def active = sh(script: "curl -s http://localhost:8081 | grep -o 'blue\\|green' || echo 'none'", returnStdout: true).trim()
                    def newColor = (active == 'blue') ? 'green' : 'blue'
                    echo "Active container: ${active}. Deploying new version as: ${newColor}"

                    // Stop and remove old container of same color (if any)
                    sh """
                    if /usr/local/bin/docker ps -a --format '{{.Names}}' | grep -w ${newColor}; then
                        echo "🧹 Removing old ${newColor} container..."
                        /usr/local/bin/docker stop ${newColor} || true
                        /usr/local/bin/docker rm ${newColor} || true
                    fi
                    """

                    // Deploy new version
                    def hostPort = (newColor == 'blue') ? '3000' : '3001'
                    sh "/usr/local/bin/docker run -d -p ${hostPort}:3000 --name ${newColor} -e COLOR=${newColor} ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"

                    // Wait and health-check
                    sleep 5
                    def health = sh(script: "curl -s http://localhost:${hostPort} | grep '${newColor}' || echo 'fail'", returnStdout: true).trim()

                    if (health.contains(newColor)) {
                        echo "✅ ${newColor} container healthy."

                        // Ensure Nginx is running
                        def nginxRunning = sh(script: "/usr/local/bin/docker ps --filter 'name=nginx' --format '{{.Names}}' | head -n1", returnStdout: true).trim()
                        if (!nginxRunning) {
                            echo "🚀 Starting Nginx container..."
                            sh """
                            /usr/local/bin/docker start nginx || \
                            /usr/local/bin/docker run -d --name nginx -p 8081:80 -v \$(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf nginx:latest
                            """
                            sleep 3
                        }

                        // Update nginx.conf
                        echo "🔁 Updating nginx.conf to point to ${newColor}..."
                        sh """
                        if [ "${active}" != "none" ]; then
                            sed -i '' 's/${active}/${newColor}/' nginx/nginx.conf 2>/dev/null || sed -i 's/${active}/${newColor}/' nginx/nginx.conf
                        else
                            sed -i '' 's/blue/${newColor}/' nginx/nginx.conf 2>/dev/null || sed -i 's/blue/${newColor}/' nginx/nginx.conf
                        fi
                        """

                        // Reload Nginx config
                        echo "♻️ Reloading Nginx..."
                        sh "/usr/local/bin/docker exec nginx nginx -s reload || echo 'Reload skipped (container just started)'"

                        // Remove old active container
                        if (active != 'none') {
                            sh "/usr/local/bin/docker stop ${active} || true"
                            sh "/usr/local/bin/docker rm ${active} || true"
                            echo "🧼 Old container ${active} stopped and removed."
                        }

                    } else {
                        echo "❌ ${newColor} container failed health check. Rolling back..."
                        sh "/usr/local/bin/docker stop ${newColor} || true"
                        sh "/usr/local/bin/docker rm ${newColor} || true"
                        error("Deployment failed")
                    }
                }
            }
        }
    }
}
