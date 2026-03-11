#!/bin/bash
# Notification Scheduler Cron Script
# Run delivery reminders and payment due notifications
# Schedule this to run once daily at 9 AM via cron:
# 0 9 * * * /app/backend/cron_notifications.sh >> /var/log/supervisor/notifications_cron.log 2>&1

cd /app/backend
/usr/bin/python3 /app/backend/notification_scheduler.py
