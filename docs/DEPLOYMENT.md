# Deployment outline

This project is not deployment-ready yet. Before production, document one container per service (gateway 8000, auth 6001, product 6002, order 6004, admin 6005, chat 6006, recommendation 6007, logger 6008) and the required root `.env` variables for each process.

TODO:

- Add CI/CD builds and health checks for every Nx application.
- Expose the Stripe webhook endpoint separately from authenticated gateway traffic.
- Terminate TLS and use `wss://` for chat and logger WebSockets.
- Restrict the admin dashboard by network policy and strong admin authentication.
- Provision Kafka topics `chat.new_message`, `logs`, and the user-activity topic.
- Add MongoDB replica-set backups, Redis persistence, and secret rotation.
