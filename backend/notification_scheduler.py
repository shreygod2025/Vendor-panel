#!/usr/bin/env python3
"""
Notification Scheduler for OLL Vendor Management System
Runs as a background cron job to send scheduled notifications

This script handles:
- Delivery date reminders (6, 4, 2, 0 days before)
- Payment due date reminders
- Confirmation reminders on delivery date

Run this script via cron every hour or use a scheduler
Example crontab entry:
0 9 * * * /usr/bin/python3 /app/backend/notification_scheduler.py >> /var/log/notifications.log 2>&1
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path
ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))

load_dotenv(ROOT_DIR / '.env')

# Import email service
from email_service import (
    notify_vendor_delivery_reminder,
    notify_admin_payment_due,
    get_admin_emails,
    is_email_configured,
    send_email_async,
    template_delivery_reminder,
    template_admin_payment_due,
    send_daily_delivery_report
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/var/log/supervisor/notifications.log', mode='a')
    ]
)
logger = logging.getLogger('notification_scheduler')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Reminder days configuration
DELIVERY_REMINDER_DAYS = [6, 4, 2, 0]  # Days before delivery date


async def get_pos_needing_delivery_reminder(target_date: str):
    """
    Get POs that need delivery reminders for a specific date
    Only considers POs in 'confirmed' or 'dispatched' status
    """
    try:
        pos = await db.purchase_orders.find(
            {
                "delivery_date": target_date,
                "status": {"$in": ["confirmed", "dispatched"]},
            },
            {"_id": 0}
        ).to_list(1000)
        return pos
    except Exception as e:
        logger.error(f"Failed to get POs for delivery reminder: {e}")
        return []


async def get_vendor_by_id(vendor_id: str):
    """Get vendor details by ID"""
    try:
        vendor = await db.vendors.find_one(
            {"id": vendor_id},
            {"_id": 0}
        )
        return vendor
    except Exception as e:
        logger.error(f"Failed to get vendor {vendor_id}: {e}")
        return None


async def get_pending_invoices_with_due_dates():
    """
    Get invoices with pending payments and their due dates
    Calculates due date as invoice_date + 30 days (configurable)
    """
    try:
        invoices = await db.invoices.find(
            {"payment_status": {"$in": ["pending", "partial"]}},
            {"_id": 0}
        ).to_list(1000)
        return invoices
    except Exception as e:
        logger.error(f"Failed to get pending invoices: {e}")
        return []


async def check_notification_sent(notification_type: str, reference_id: str, reference_date: str):
    """Check if a notification was already sent today"""
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        existing = await db.notification_log.find_one({
            "type": notification_type,
            "reference_id": reference_id,
            "reference_date": reference_date,
            "sent_date": today
        })
        return existing is not None
    except Exception as e:
        logger.error(f"Failed to check notification log: {e}")
        return False


async def log_notification_sent(notification_type: str, reference_id: str, reference_date: str, recipient: str):
    """Log that a notification was sent"""
    try:
        await db.notification_log.insert_one({
            "type": notification_type,
            "reference_id": reference_id,
            "reference_date": reference_date,
            "recipient": recipient,
            "sent_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "sent_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to log notification: {e}")


async def send_delivery_reminders():
    """Send delivery date reminders to vendors"""
    logger.info("Starting delivery reminder check...")
    
    today = datetime.now(timezone.utc).date()
    sent_count = 0
    
    for days_ahead in DELIVERY_REMINDER_DAYS:
        target_date = (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
        logger.info(f"Checking for deliveries on {target_date} ({days_ahead} days ahead)")
        
        pos = await get_pos_needing_delivery_reminder(target_date)
        logger.info(f"Found {len(pos)} POs with delivery date {target_date}")
        
        for po in pos:
            po_id = po.get('id')
            
            # Check if already sent today
            already_sent = await check_notification_sent(
                f"delivery_reminder_{days_ahead}",
                po_id,
                target_date
            )
            
            if already_sent:
                logger.debug(f"Reminder already sent for PO {po.get('po_number')}")
                continue
            
            # Get vendor details
            vendor = await get_vendor_by_id(po.get('vendor_id'))
            if not vendor or not vendor.get('email'):
                logger.warning(f"No vendor/email for PO {po.get('po_number')}")
                continue
            
            # Send reminder
            try:
                subject, html = template_delivery_reminder(po, vendor, days_ahead)
                success = await send_email_async(vendor['email'], subject, html)
                
                if success:
                    await log_notification_sent(
                        f"delivery_reminder_{days_ahead}",
                        po_id,
                        target_date,
                        vendor['email']
                    )
                    sent_count += 1
                    logger.info(f"Sent delivery reminder for PO {po.get('po_number')} to {vendor['email']}")
                    
            except Exception as e:
                logger.error(f"Failed to send reminder for PO {po.get('po_number')}: {e}")
    
    logger.info(f"Delivery reminder check complete. Sent {sent_count} reminders.")
    return sent_count


async def send_payment_due_reminders():
    """Send payment due date reminders to admins"""
    logger.info("Starting payment due reminder check...")
    
    admin_emails = await get_admin_emails(db)
    if not admin_emails:
        logger.warning("No admin emails found - skipping payment reminders")
        return 0
    
    today = datetime.now(timezone.utc).date()
    sent_count = 0
    
    invoices = await get_pending_invoices_with_due_dates()
    logger.info(f"Found {len(invoices)} pending invoices to check")
    
    # Payment reminder days (before due date and after)
    reminder_days = [7, 3, 0, -3, -7]  # 7, 3 days before, on due date, 3, 7 days after
    
    for invoice in invoices:
        # Calculate due date (assuming 30 days from invoice date)
        try:
            invoice_date = datetime.strptime(invoice.get('invoice_date', ''), "%Y-%m-%d").date()
            due_date = invoice_date + timedelta(days=30)
        except Exception:
            continue
        
        days_until_due = (due_date - today).days
        
        # Check if this is a reminder day
        if days_until_due not in reminder_days:
            continue
        
        invoice_id = invoice.get('id')
        due_date_str = due_date.strftime("%Y-%m-%d")
        
        # Check if already sent today
        already_sent = await check_notification_sent(
            f"payment_due_{days_until_due}",
            invoice_id,
            due_date_str
        )
        
        if already_sent:
            continue
        
        # Get vendor details
        vendor = await get_vendor_by_id(invoice.get('vendor_id'))
        if not vendor:
            continue
        
        # Send reminder to all admins
        try:
            subject, html = template_admin_payment_due(invoice, vendor, days_until_due)
            
            for admin_email in admin_emails:
                success = await send_email_async(admin_email, subject, html)
                if success:
                    sent_count += 1
            
            await log_notification_sent(
                f"payment_due_{days_until_due}",
                invoice_id,
                due_date_str,
                ','.join(admin_emails)
            )
            
            logger.info(f"Sent payment reminder for Invoice {invoice.get('invoice_number')}")
            
        except Exception as e:
            logger.error(f"Failed to send payment reminder for Invoice {invoice.get('invoice_number')}: {e}")
    
    logger.info(f"Payment reminder check complete. Sent {sent_count} reminders.")
    return sent_count


async def run_scheduler():
    """Main scheduler function"""
    logger.info("=" * 60)
    logger.info("Starting notification scheduler run")
    logger.info(f"Current time: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 60)
    
    if not is_email_configured():
        logger.warning("Email service not configured (no RESEND_API_KEY). Exiting.")
        return
    
    try:
        # Get admin emails once
        admin_emails = await get_admin_emails(db)
        
        # Send daily delivery report to admins
        if admin_emails:
            report_sent, delivery_count = await send_daily_delivery_report(db, admin_emails)
            logger.info(f"Daily delivery report sent to {report_sent} admins ({delivery_count} deliveries due today)")
        
        # Send delivery reminders to vendors
        delivery_reminder_count = await send_delivery_reminders()
        
        # Send payment due reminders to admins
        payment_count = await send_payment_due_reminders()
        
        logger.info("=" * 60)
        logger.info(f"Scheduler run complete. Delivery reminders: {delivery_reminder_count}, Payment reminders: {payment_count}")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Scheduler error: {e}", exc_info=True)
    finally:
        # Close MongoDB connection
        client.close()


if __name__ == "__main__":
    asyncio.run(run_scheduler())
