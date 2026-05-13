pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    APP_ROOT = '/opt/social-app'
    DATA_DIR = '/opt/social-app/data'
    APP_DIR = '/opt/social-app/app'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Backend unit tests') {
      when {
        buildingTag()
      }
      steps {
        sh '''
          set -eu
          docker run --rm \
            -u "$(id -u):$(id -g)" \
            -e HOME=/tmp/jenkins-py-home \
            -e PIP_CACHE_DIR=/tmp/jenkins-pip-cache \
            -e PIP_DISABLE_PIP_VERSION_CHECK=1 \
            -e DEBUG=true \
            -v "${WORKSPACE}:/ws:rw" \
            -w /ws/server \
            python:3.11-bookworm \
            bash -ec 'mkdir -p "$HOME" "$PIP_CACHE_DIR" && export PATH="$HOME/.local/bin:$PATH" && python -m pip install --upgrade pip && python -m pip install --no-cache-dir -r requirements.txt && python -m prisma generate --schema prisma/schema.prisma && python -m pytest tests/unit --confcutdir=tests/unit -q -m unit'
        '''
      }
    }

    stage('Sync Deploy Files') {
      when {
        buildingTag()
      }
      steps {
        sh '''
          set -eu
          mkdir -p "$DATA_DIR" "$APP_DIR"
          cp deploy/data/docker-compose.yml "$DATA_DIR/docker-compose.yml"
          cp deploy/data/env.example "$DATA_DIR/env.example"
          cp deploy/data/bootstrap_defaults.sh "$DATA_DIR/bootstrap_defaults.sh"
          cp deploy/data/reset_database.sh "$DATA_DIR/reset_database.sh"
          chmod +x "$DATA_DIR/bootstrap_defaults.sh" "$DATA_DIR/reset_database.sh"
          cp deploy/app/docker-compose.yml "$APP_DIR/docker-compose.yml"
          cp deploy/app/env.example "$APP_DIR/env.example"
          cp deploy/app/nginx.frontend.conf "$APP_DIR/nginx.frontend.conf"
          [ -f "$DATA_DIR/.env" ] || cp "$DATA_DIR/env.example" "$DATA_DIR/.env"
          [ -f "$APP_DIR/.env" ] || cp "$APP_DIR/env.example" "$APP_DIR/.env"
        '''
      }
    }

    stage('Ensure Mongo Keyfile') {
      when {
        buildingTag()
      }
      steps {
        sh '''
          set -eu
          if [ ! -f "$DATA_DIR/mongo-keyfile" ]; then
            openssl rand -base64 756 > "$DATA_DIR/mongo-keyfile"
          fi
          chmod 400 "$DATA_DIR/mongo-keyfile"
        '''
      }
    }

    stage('Deploy Data Stack') {
      when {
        buildingTag()
      }
      steps {
        sh '''
          set -eu
          docker compose --env-file "$DATA_DIR/.env" -f "$DATA_DIR/docker-compose.yml" up -d
        '''
      }
    }

    stage('Ensure Mongo Replica Set') {
      when {
        buildingTag()
      }
      steps {
        sh '''
          set -eu
          set -a
          . "$DATA_DIR/.env"
          set +a
          docker compose --env-file "$DATA_DIR/.env" -f "$DATA_DIR/docker-compose.yml" exec -T mongodb \
            mongosh -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval '
              try { rs.status() } catch (e) {
                rs.initiate({_id:"rs0",members:[{_id:0,host:"mongodb:27017"}]})
              }
            '
        '''
      }
    }

    stage('Bootstrap DB defaults (roles, categories, admin)') {
      when {
        buildingTag()
      }
      steps {
        sh '''
          set -eu
          bash "$DATA_DIR/bootstrap_defaults.sh"
        '''
      }
    }

    stage('Deploy App Stack') {
      when {
        buildingTag()
      }
      steps {
        sh '''
          set -eu
          BUILD_CONTEXT="$WORKSPACE" \
          docker compose --env-file "$APP_DIR/.env" -f "$APP_DIR/docker-compose.yml" up -d --build
        '''
      }
    }

    stage('Smoke Test') {
      when {
        buildingTag()
      }
      steps {
        sh '''
          set -eu
          ok=0
          for i in $(seq 1 20); do
            if curl -fsS http://127.0.0.1:8000/health >/dev/null; then
              ok=1
              break
            fi
            echo "Waiting for backend health... attempt ${i}/20"
            sleep 3
          done
          if [ "$ok" -ne 1 ]; then
            echo "Backend health check failed after retries. Last logs:"
            docker logs --tail 200 social-backend || true
            exit 1
          fi

          curl -fsS http://127.0.0.1:3000 >/dev/null
        '''
      }
    }
  }
}
