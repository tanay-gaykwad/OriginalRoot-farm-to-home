# Security policy

## Supported version

Security fixes are developed against the latest code on the `main` branch. No older release series is currently maintained.

## Report a vulnerability

Please use GitHub's private vulnerability reporting for this repository: open the repository's **Security** tab and choose **Report a vulnerability**. Do not file a public issue or discussion for an unpatched vulnerability. If private reporting is unavailable, contact the repository owner privately through their GitHub profile and ask for a secure disclosure channel.

Include the affected component, impact, and steps to reproduce. Avoid sending real customer or farmer data. We will acknowledge reports as soon as practical, investigate, and coordinate disclosure after a fix or mitigation is available.

## Safe use

The local Docker service binds to loopback by default. Do not expose it to a public network: this project does not yet provide production-grade identity recovery, rate limiting, monitoring, backup and recovery, or a managed secret store. Never commit `.env` files, credentials, real personal information, or production database files.
