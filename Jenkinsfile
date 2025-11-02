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
                    def active = sh(script: "curl -s http://localhost:8081 | grep -o 'blue\\|green' || echo 'none'", returnStdout: true).trim()
                    def newColor = (active == 'blue') ? 'green' : 'blue'

                    sh """
                    if /usr/local/bin/docker ps -a --format '{{.Names}}' | grep -w ${newColor}; then
                        /usr/local/bin/docker stop ${newColor} || true
                        /usr/local/bin/docker rm ${newColor} || true
                    fi
                    """

                    def hostPort = (newColor == 'blue') ? '3000' : '3001'
                    sh "/usr/local/bin/docker run -d -p ${hostPort}:3000 --name ${newColor} -e COLOR=${newColor} ${DOCKERHUB_USERNAME}/${IMAGE}:${BUILD_NUMBER}"

                    sleep 5

                    def health = sh(script: "curl -s http://localhost:${hostPort} | grep '${newColor}' || echo 'fail'", returnStdout: true).trim()

                    if (health.contains(newColor)) {
                        def nginxContainer = "nginx"
                        if (!nginxContainer) {
                            error("Nginx container not found")
                        }

                        if (active != 'none') {
                            sh "sed -i '' 's/${active}/${newColor}/' nginx/nginx.conf"
                        } else {
                            sh "sed -i '' 's/blue/${newColor}/' nginx/nginx.conf"
                        }

                        sh "/usr/local/bin/docker exec ${nginxContainer} nginx -s reload"

                        if (active != 'none') {
                            sh "/usr/local/bin/docker stop ${active} || true"
                            sh "/usr/local/bin/docker rm ${active} || true"
                        }

                    } else {
                        sh "/usr/local/bin/docker stop ${newColor} || true"
                        sh "/usr/local/bin/docker rm ${newColor} || true"
                        error("Deployment failed")
                    }
                }
            }
        }
    }
}
