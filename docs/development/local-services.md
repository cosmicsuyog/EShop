# Local services

## MongoDB

The development database is isolated from any pre-existing MongoDB installation:

- Bind address: 127.0.0.1
- Port: 27018
- Replica set: eshop-dev
- Database: eshop_development
- Data directory: tmp/eshop-dev-mongodb/data

Start a dedicated process with:

~~~powershell
New-Item -ItemType Directory -Force tmp/eshop-dev-mongodb/data | Out-Null
mongod --dbpath "$PWD/tmp/eshop-dev-mongodb/data" --bind_ip 127.0.0.1 --port 27018 --replSet eshop-dev
~~~

Initialize once:

~~~powershell
mongosh "mongodb://127.0.0.1:27018/admin?directConnection=true" --eval "rs.initiate({_id:'eshop-dev',members:[{_id:0,host:'127.0.0.1:27018'}]})"
~~~

Check that the member reaches PRIMARY before Prisma schema synchronization. Never point the local wrapper at port 27017 or a remote database.

## Redis

Auth Service uses Redis for OTP limits, password-reset grants, and refresh-session state. Redis must be running before authentication/session flows. If Docker Desktop is available:

~~~powershell
docker run --rm --name eshop-redis -p 6379:6379 redis:7-alpine
~~~

Set REDIS_DATABASE_URL in .env.local to the local Redis address. The example container does not persist Redis data.

## Email

Nodemailer uses the SMTP settings in .env.local. Supply the host, port, user, password, and service value required by your provider. Without working SMTP, customer/seller OTP and password-recovery messages cannot be delivered.

## Stripe Connect

Use test-mode Stripe credentials only. Configure the server-side secret key, webhook signing secret, and seller UI refresh/return URLs. The application creates seller Connect onboarding and dashboard links; it does not collect customer payments.

## ImageKit

Configure the server-side ImageKit private key to enable seller product image upload and removal. The API accepts PNG, JPEG, and WebP image data up to 5 MiB each and allows up to eight unattached uploads per seller. Provider operations require a working ImageKit account.

See [environment configuration](environment-configuration.md) and [installation](installation.md).
