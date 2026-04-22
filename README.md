# 🔐 JWT Authentication Microservice — Docker · Jenkins · Kubernetes

A production-grade JWT Authentication Service built with Node.js, Express, and MongoDB. Features full user registration, login, token refresh, logout, role-based access control, and an admin panel — all deployed through a complete CI/CD pipeline.

---

## 📁 Project Structure

```
auth-service/
├── app/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── auth.controller.js   # Register, Login, Refresh, Logout
│   │   │   └── user.controller.js   # Profile, Update, Admin routes
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js   # JWT protect + role restriction
│   │   │   └── error.middleware.js  # Global error handler
│   │   ├── models/
│   │   │   └── user.model.js        # Mongoose schema + bcrypt hashing
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   └── user.routes.js
│   │   ├── utils/
│   │   │   └── jwt.utils.js         # Token generation + verification
│   │   └── index.js                 # Express app entry point
│   ├── tests/
│   │   └── auth.test.js
│   └── package.json
├── docker/
│   └── nginx.conf
├── k8s/
│   ├── base/
│   │   ├── secret.yaml              # JWT secrets + MongoDB URI
│   │   ├── configmap.yaml
│   │   ├── deployment.yaml
│   │   ├── mongo-statefulset.yaml   # MongoDB with PersistentVolume
│   │   ├── service.yaml
│   │   ├── ingress.yaml
│   │   ├── hpa.yaml
│   │   └── kustomization.yaml
│   └── overlays/
│       ├── dev/
│       └── prod/
├── .env.example
├── .gitignore
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── Jenkinsfile
└── auth-ui.html                     # Live interactive UI
```

---

## 🔑 What's New Compared to the Todo API

| Feature | Todo API | Auth Service |
|---------|----------|-------------|
| Database | In-memory | MongoDB (persistent) |
| Authentication | None | JWT Access + Refresh tokens |
| Authorization | None | Role-based (user / admin) |
| Password storage | N/A | bcrypt (12 salt rounds) |
| Rate limiting | Basic | Strict on auth routes (10 req/min) |
| K8s storage | None | PersistentVolumeClaim for MongoDB |
| K8s secrets | None | Kubernetes Secrets for JWT keys |
| Token rotation | N/A | Refresh token rotation on every use |

---

## ✅ Prerequisites

Same as the Todo API project — Docker Desktop, Node.js v20, kubectl, Minikube, ngrok.

---

## 🐳 Part 1 — Run with Docker Compose

### Step 1 — Start all services

```powershell
cd auth-service
docker compose up -d
```

Services started:
```
✔ Container mongo       Running   (MongoDB database)
✔ Container auth-api    Running   (JWT Auth Service)
✔ Container nginx-auth  Running   (Reverse proxy)
✔ Container jenkins     Running   (CI/CD)
```

### Step 2 — Install Docker inside Jenkins

```powershell
docker exec -u 0 jenkins bash -c "apt-get update -qq && apt-get install -y docker.io && chmod 666 /var/run/docker.sock"
```

### Step 3 — Verify

```powershell
curl http://localhost:4000/health
```

Expected: `{"status":"UP","version":"1.0.0-local"}`

```powershell
curl http://localhost:4000/ready
```

Expected: `{"status":"READY","database":"connected"}`

> The `/ready` endpoint only returns READY when MongoDB is also connected — this is what makes it a true readiness probe.

---

## 🏗️ Part 2 — Jenkins Pipeline

Same Jenkins setup as the Todo API project. The pipeline runs:

```
Checkout → Install → Lint → Test → Docker Build → Security Scan → Push → Deploy
```

Configure NodeJS-20 tool and create a Pipeline job pointing to this repo's `Jenkinsfile`.

---

## ☸️ Part 3 — Kubernetes with Minikube

### Step 1 — Start Minikube

```powershell
minikube start --driver=docker --cpus=2 --memory=4g --addons=ingress,metrics-server
```

> Use 4g RAM instead of 3g — MongoDB needs extra memory.

### Step 2 — Point Docker to Minikube

```powershell
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
```

### Step 3 — Build image inside Minikube

```powershell
docker build --target production -t jwt-auth-service:local .
```

### Step 4 — Update the secret (before deploying)

Open `k8s/base/secret.yaml` and replace the placeholder values:

```yaml
stringData:
  JWT_ACCESS_SECRET:  "your-actual-long-random-secret-here"
  JWT_REFRESH_SECRET: "your-actual-long-random-secret-here"
  MONGO_URI:          "mongodb://mongo-service:27017/authdb"
```

Generate strong secrets with:
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 5 — Deploy to Kubernetes

```powershell
kubectl apply -k k8s/overlays/dev/
```

### Step 6 — Fix image reference

```powershell
kubectl set image deployment/jwt-auth-service jwt-auth-service=jwt-auth-service:local -n auth-dev
kubectl patch deployment jwt-auth-service -n auth-dev -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"jwt-auth-service\",\"imagePullPolicy\":\"Never\"}]}}}}'
```

### Step 7 — Wait for pods

```powershell
kubectl get pods -n auth-dev -w
```

Wait until both `jwt-auth-service` and `mongo` show `Running`.

### Step 8 — Port-forward

```powershell
kubectl port-forward svc/jwt-auth-service 4000:80 -n auth-dev
```

---

## 🌐 Part 4 — Share via ngrok

```powershell
.\ngrok http 4000
```

Open `auth-ui.html` in any browser → paste the ngrok URL → click Connect.

---

## 📊 API Reference

### Auth Routes (`/api/auth/`) — Rate limited: 10 req/15min

| Method | Endpoint | Auth | Body | Description |
|--------|----------|------|------|-------------|
| POST | `/api/auth/register` | None | `{name, email, password}` | Create account |
| POST | `/api/auth/login` | None | `{email, password}` | Login |
| POST | `/api/auth/refresh` | None | `{refreshToken}` | Get new tokens |
| POST | `/api/auth/logout` | Bearer | `{refreshToken}` | Logout this device |
| POST | `/api/auth/logout-all` | Bearer | — | Logout all devices |

### User Routes (`/api/users/`) — Requires Bearer token

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/users/me` | Any | Get my profile |
| PATCH | `/api/users/me` | Any | Update my name |
| PATCH | `/api/users/me/password` | Any | Change password |
| GET | `/api/users/` | Admin | List all users |
| PATCH | `/api/users/:id/deactivate` | Admin | Deactivate a user |

### System Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Liveness probe |
| GET | `/ready` | Readiness probe (checks DB connection) |

---

## 🧪 Testing with PowerShell

```powershell
# Register
Invoke-WebRequest -Uri http://localhost:4000/api/auth/register -Method POST -ContentType "application/json" -Body '{"name":"Suyog","email":"suyog@example.com","password":"password123"}'

# Login
Invoke-WebRequest -Uri http://localhost:4000/api/auth/login -Method POST -ContentType "application/json" -Body '{"email":"suyog@example.com","password":"password123"}'

# Get profile (replace TOKEN with your access token)
Invoke-WebRequest -Uri http://localhost:4000/api/users/me -Method GET -Headers @{Authorization="Bearer TOKEN"}

# Refresh tokens (replace REFRESH_TOKEN)
Invoke-WebRequest -Uri http://localhost:4000/api/auth/refresh -Method POST -ContentType "application/json" -Body '{"refreshToken":"REFRESH_TOKEN"}'

# Logout
Invoke-WebRequest -Uri http://localhost:4000/api/auth/logout -Method POST -Headers @{Authorization="Bearer TOKEN"} -ContentType "application/json" -Body '{"refreshToken":"REFRESH_TOKEN"}'
```

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt with 12 salt rounds |
| Access tokens | JWT, expires in 15 minutes |
| Refresh tokens | JWT, expires in 7 days, stored in DB |
| Token rotation | New refresh token issued on every refresh |
| Rate limiting | 10 req/15min on auth routes |
| Role-based access | `user` and `admin` roles |
| Input validation | Mongoose schema validators |
| Security headers | Helmet.js |
| Non-root container | Runs as appuser (UID 1000) |
| Read-only filesystem | Kubernetes securityContext |

---

## 🔄 Daily Startup

```powershell
# Terminal 1 — Docker Compose
docker compose up -d
docker exec -u 0 jenkins bash -c "apt-get update -qq && apt-get install -y docker.io && chmod 666 /var/run/docker.sock"

# Terminal 2 — Port forward
kubectl port-forward svc/jwt-auth-service 4000:80 -n auth-dev

# Terminal 3 — ngrok
.\ngrok http 4000
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Database | MongoDB 7 (Mongoose ODM) |
| Auth | JWT (jsonwebtoken) |
| Password | bcryptjs (12 rounds) |
| Testing | Jest + Supertest |
| Container | Docker (multi-stage) |
| Compose | Docker Compose |
| Proxy | Nginx (with rate limiting) |
| CI/CD | Jenkins (Declarative Pipeline) |
| Orchestration | Kubernetes + Kustomize |
| DB Storage | Kubernetes PersistentVolumeClaim |
| Secrets | Kubernetes Secrets |
| Auto-scaling | HPA (2–10 pods) |
| Security Scan | Trivy |
| Tunnel | ngrok |

---

*DevOps Internship Project — Savitribai Phule Pune University 2025-26*
*Dr. D.Y. Patil Technical Campus, Talegaon Dabhade, Pune*
