# Installation

These steps describe local Windows PowerShell setup. They target the isolated MongoDB database at 127.0.0.1:27018; do not substitute the existing service on port 27017.

## Prerequisites

- Windows PowerShell 5.1 or PowerShell 7.
- Node.js 20 and npm.
- MongoDB server tools (mongod and mongosh) with replica-set support.
- Redis reachable at 127.0.0.1:6379.
- SMTP provider credentials for email delivery.
- Stripe test account credentials for Connect flows.
- ImageKit credentials for product image uploads.

Docker Desktop can run Redis if a local Redis service is not installed.

## Install dependencies

From the repository root:

~~~powershell
npm ci --legacy-peer-deps
~~~

## Configure local environment

Create .env.local from the placeholder file only when it does not already exist:

~~~powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
~~~

Edit .env.local with unique local token secrets and required provider settings. The root .env is tracked legacy configuration; do not copy it or use it for database writes. See [environment configuration](environment-configuration.md).

## Start MongoDB

Open a PowerShell window and run:

~~~powershell
New-Item -ItemType Directory -Force tmp/eshop-dev-mongodb/data | Out-Null
mongod --dbpath "$PWD/tmp/eshop-dev-mongodb/data" --bind_ip 127.0.0.1 --port 27018 --replSet eshop-dev
~~~

In another window, initialize the replica set for its first use:

~~~powershell
mongosh "mongodb://127.0.0.1:27018/admin?directConnection=true" --eval "rs.initiate({_id:'eshop-dev',members:[{_id:0,host:'127.0.0.1:27018'}]})"
~~~

If MongoDB reports that the replica set is already initialized, check its status and wait for PRIMARY:

~~~powershell
mongosh "mongodb://127.0.0.1:27018/admin?directConnection=true" --eval "rs.status().members.map(m => ({name:m.name,stateStr:m.stateStr}))"
~~~

Keep the MongoDB process running.

## Start Redis and synchronize Prisma

Run Redis locally, or use Docker if available:

~~~powershell
docker run --rm --name eshop-redis -p 6379:6379 redis:7-alpine
~~~

In a separate terminal, validate/generate Prisma Client and synchronize the local development schema:

~~~powershell
./tools/Invoke-LocalPrisma.ps1 validate
./tools/Invoke-LocalPrisma.ps1 generate
./tools/Invoke-LocalPrisma.ps1 db push
~~~

These wrappers verify the exact local MongoDB target before Prisma runs.

## Run the applications

Start Auth Service, Product Service, and the Gateway first. Then start the storefronts in separate terminals:

~~~powershell
./tools/Invoke-LocalNx.ps1 serve auth-service
./tools/Invoke-LocalNx.ps1 serve product-service
./tools/Invoke-LocalNx.ps1 serve api-gateway
./tools/Invoke-LocalNx.ps1 dev user-ui '--port=3000'
./tools/Invoke-LocalNx.ps1 dev seller-ui '--port=3001'
~~~

The customer app is at http://localhost:3000, seller app at http://localhost:3001, and API Gateway at http://localhost:8000. See [local services](local-services.md), [development workflow](development-workflow.md), and the [testing guide](../testing/testing-guide.md).
