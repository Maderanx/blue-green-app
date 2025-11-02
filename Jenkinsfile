pipeline {
    agent any

    environment {
        DOCKERHUB_PAT = credentials('dockerhub-pat')  // Jenkins Secret Text ID
        DOCKERHUB_USERNAME = "maderanx"               // Docker Hub username
        IMAGE = "bluegreen-node"
        DOCKER_BUILDKIT = "0"                         // Disable BuildKit
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
                    // Safe: No Groovy interpolation with credentials
                    sh '''
                        #!/bin/bash
                        echo "$DOCKERHUB_PAT" | /usr/local/bin/docker login -u "$DOCKERHUB_USERNAME" --password-stdin
                    '''
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    sh '''
                        #!/bin/bash
                        /usr/local/bin/docker build -t "${IMAGE}:${BUILD_NUMBER}" .
                    '''
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                script {
                    sh '''
                        #!/bin/bash
                        /usr/local/bin/docker tag "${IMAGE}:${BUILD_NUMBER}" "${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"
                        /usr/local/bin/docker push "${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"
                    '''
                }
            }
        }

        stage('Blue-Green Deployment') {
            steps {
                script {
                    sh '''
                        #!/bin/bash

                        active=$(curl -s http://localhost:8081 | grep -o 'blue\\|green' || echo 'none')
                        newColor=$([ "$active" = "blue" ] && echo "green" || echo "blue")

                        echo "Active container: $active. Deploying new version as: $newColor"

                        # Stop and remove existing same-color container
                        if /usr/local/bin/docker ps -a --format '{{.Names}}' | grep -w "$newColor"; then
                            echo "Stopping and removing existing $newColor container..."
                            /usr/local/bin/docker stop "$newColor" || true
                            /usr/local/bin/docker rm "$newColor" || true
                        fi

                        hostPort=$([ "$newColor" = "blue" ] && echo "3000" || echo "3001")

                        /usr/local/bin/docker run -d -p "$hostPort:3000" --name "$newColor" -e COLOR="$newColor" "${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"

                        sleep 5

                        health=$(curl -s "http://localhost:$hostPort" | grep "$newColor" || echo "fail")

                        if echo "$health" | grep -q "$newColor"; then
                            echo "✅ $newColor is healthy. Switching Nginx traffic..."
                            nginxContainer="nginx"

                            if [ -z "$nginxContainer" ]; then
                                echo "❌ Nginx container not found. Cannot switch traffic."
                                exit 1
                            fi

                            if [ "$active" != "none" ]; then
                                sed -i '' "s/$active/$newColor/" nginx/nginx.conf
                            else
                                sed -i '' "s/blue/$newColor/" nginx/nginx.conf
                            fi

                            /usr/local/bin/docker exec "$nginxContainer" nginx -s reload

                            if [ "$active" != "none" ]; then
                                echo "Stopping and removing old active container: $active"
                                /usr/local/bin/docker stop "$active" || true
                                /usr/local/bin/docker rm "$active" || true
                            fi
                        else
                            echo "❌ Deployment failed. Keeping $active live."
                            /usr/local/bin/docker stop "$newColor" || true
                            /usr/local/bin/docker rm "$newColor" || true
                            exit 1
                        fi
                    '''
                }
            }
        }
    }
}
