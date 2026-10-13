# Services Layer

This directory holds core business logic and third-party integrations separated from Express controllers:
- `jobService.js`: Job extraction, scoring, matching against user profile.
- `userService.js`: User profile management, resume parsing coordination.
- `applicationService.js`: Tracking application submissions and status updates.
- `emailService.js`: Transactional notifications and application alerts.
