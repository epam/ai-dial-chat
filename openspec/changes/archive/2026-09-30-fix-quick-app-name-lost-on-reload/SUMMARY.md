# Quick App Name Reload Fix

Fixes #9169.

- Creating an application invalidates both applications and deployments-list caches.
- A Quick App keeps submitted metadata during its in-place create-to-edit transition.
- A fresh editor mount restores persisted metadata after reload.

Verified with the application-service, Quick App editor, and edited-application test files.
