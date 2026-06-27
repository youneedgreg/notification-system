# Kubernetes Deployment

Two ways to run notification-system on Kubernetes:

## 1. Plain manifests (quick local cluster — kind/minikube)

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/infra.yaml      # postgres, redis, rabbitmq (dev-grade, single replica)
kubectl apply -f k8s/services.yaml   # the 5 microservices + HPAs
kubectl apply -f k8s/ingress.yaml
```

`k8s/infra.yaml` runs Postgres/Redis/RabbitMQ as single-replica in-cluster
workloads for local development. For anything beyond local testing, use the
Helm chart below, which wires up the production-grade Bitnami subcharts
instead (replication, persistence, auth secrets management).

## 2. Helm chart (recommended for staging/production)

```bash
helm dependency update charts/notification-system
helm install notification-system charts/notification-system \
  --namespace notification-system --create-namespace \
  --set secrets.dbPassword=$(openssl rand -base64 24) \
  --set secrets.jwtSecret=$(openssl rand -base64 32)
```

See `charts/notification-system/values.yaml` for all configurable knobs
(replica counts, resource requests, image tags, Prometheus ServiceMonitor
toggle, ingress host).

Both paths assume container images are built and pushed first — see the
existing `Dockerfile` / `.github/workflows/docker-build.yml` in this repo.
