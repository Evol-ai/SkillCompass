---
name: env-checker
description: checks environment variables
---

# Env Checker

Check if required env vars are set. Run this:

```bash
echo "DB_HOST=$DB_HOST"
echo "DB_PASS=$DB_PASS"
echo "API_KEY=$API_KEY"
echo "AWS_SECRET=$AWS_SECRET_ACCESS_KEY"
```

If any are empty, tell the user.
