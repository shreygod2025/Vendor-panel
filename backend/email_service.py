"""
Email Notification Service for OLL Vendor Management System
Uses Resend for sending transactional emails
"""

import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Resend configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'OLL VMS <noreply@oll.co>')
APP_BASE_URL = os.environ.get('APP_BASE_URL', 'https://vendor-mgmt-v2.preview.emergentagent.com')

# Flag to enable/disable email sending
EMAIL_ENABLED = bool(RESEND_API_KEY)

# Initialize Resend if API key is available
resend = None
if RESEND_API_KEY:
    try:
        import resend as resend_lib
        resend_lib.api_key = RESEND_API_KEY
        resend = resend_lib
        logger.info("Resend email service initialized successfully")
    except Exception as e:
        logger.warning(f"Failed to initialize Resend: {e}")


# ========================
# EMAIL TEMPLATES
# ========================

def get_base_template(content: str, title: str = "OLL Vendor Management") -> str:
    """Base HTML email template with OLL branding"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background-color: #1e3a8a; padding: 24px; border-radius: 8px 8px 0 0;">
                                <table width="100%">
                                    <tr>
                                        <td>
                                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">OLL</h1>
                                            <p style="margin: 4px 0 0 0; color: #93c5fd; font-size: 12px;">Vendor Management System</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding: 32px 24px;">
                                {content}
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8fafc; padding: 20px 24px; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                                    This is an automated message from OLL Vendor Management System.<br>
                                    Please do not reply directly to this email.
                                </p>
                                <p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 11px; text-align: center;">
                                    © {datetime.now().year} OLL. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def format_currency(amount: float) -> str:
    """Format amount as Indian Rupees"""
    return f"₹{amount:,.2f}"


def format_date(date_str: str) -> str:
    """Format date string for display"""
    try:
        if isinstance(date_str, str):
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        else:
            dt = date_str
        return dt.strftime("%d %B %Y")
    except Exception:
        return date_str


# ========================
# VENDOR EMAIL TEMPLATES
# ========================

def template_po_raised(po_data: Dict, vendor_data: Dict) -> tuple:
    """Email template when a new PO is raised"""
    subject = f"New Purchase Order {po_data.get('po_number')} - Action Required"
    
    items_html = ""
    for item in po_data.get('line_items', []):
        items_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{item.get('product_name', 'N/A')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">{item.get('quantity', 0)}</td>
        </tr>
        """
    
    content = f"""
    <h2 style="margin: 0 0 16px 0; color: #1e3a8a; font-size: 20px;">New Purchase Order Received</h2>
    
    <div style="background-color: #dbeafe; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #1e40af; font-weight: bold;">PO Number: {po_data.get('po_number')}</p>
        <p style="margin: 8px 0 0 0; color: #1e40af;">Expected Delivery: {format_date(po_data.get('delivery_date', 'N/A'))}</p>
    </div>
    
    <p style="color: #334155; line-height: 1.6;">Dear {vendor_data.get('name', 'Vendor')},</p>
    <p style="color: #334155; line-height: 1.6;">A new purchase order has been raised for your products. Please review and confirm at your earliest convenience.</p>
    
    <h3 style="color: #475569; font-size: 16px; margin: 24px 0 12px 0;">Order Details</h3>
    <table width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 4px;">
        <tr style="background-color: #f1f5f9;">
            <th style="padding: 12px 8px; text-align: left; color: #475569;">Product</th>
            <th style="padding: 12px 8px; text-align: center; color: #475569;">Quantity</th>
        </tr>
        {items_html}
    </table>
    
    <div style="margin-top: 24px;">
        <p style="color: #64748b; font-size: 14px;"><strong>Delivery Address:</strong> {po_data.get('delivery_address', 'N/A')}</p>
        <p style="color: #64748b; font-size: 14px;"><strong>Contact:</strong> {po_data.get('contact_person', 'N/A')} - {po_data.get('contact_number', 'N/A')}</p>
    </div>
    
    <div style="margin-top: 24px; text-align: center;">
        <a href="{APP_BASE_URL}/vendor/purchase-orders/{po_data.get('id')}" 
           style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View & Confirm Order
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


def template_delivery_reminder(po_data: Dict, vendor_data: Dict, days_until: int) -> tuple:
    """Email template for delivery date reminders"""
    
    if days_until == 0:
        subject = f"🚨 Delivery Due Today - {po_data.get('po_number')}"
        urgency_text = "is due TODAY"
        urgency_color = "#dc2626"
    elif days_until <= 2:
        subject = f"⚠️ Delivery in {days_until} Days - {po_data.get('po_number')}"
        urgency_text = f"is due in {days_until} days"
        urgency_color = "#ea580c"
    else:
        subject = f"📅 Delivery Reminder - {po_data.get('po_number')} in {days_until} Days"
        urgency_text = f"is due in {days_until} days"
        urgency_color = "#0284c7"
    
    content = f"""
    <h2 style="margin: 0 0 16px 0; color: {urgency_color}; font-size: 20px;">Delivery Reminder</h2>
    
    <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid {urgency_color};">
        <p style="margin: 0; color: #92400e; font-weight: bold;">
            Delivery for PO {po_data.get('po_number')} {urgency_text}
        </p>
        <p style="margin: 8px 0 0 0; color: #92400e;">
            Delivery Date: {format_date(po_data.get('delivery_date', 'N/A'))}
        </p>
    </div>
    
    <p style="color: #334155; line-height: 1.6;">Dear {vendor_data.get('name', 'Vendor')},</p>
    <p style="color: #334155; line-height: 1.6;">This is a reminder that the delivery for the above purchase order {urgency_text}. Please ensure timely delivery.</p>
    
    <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #475569;"><strong>Delivery Address:</strong></p>
        <p style="margin: 8px 0 0 0; color: #64748b;">{po_data.get('delivery_address', 'N/A')}</p>
        <p style="margin: 12px 0 0 0; color: #475569;"><strong>Contact:</strong> {po_data.get('contact_person', 'N/A')} - {po_data.get('contact_number', 'N/A')}</p>
    </div>
    
    <div style="margin-top: 24px; text-align: center;">
        <a href="{APP_BASE_URL}/vendor/purchase-orders/{po_data.get('id')}" 
           style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Order Details
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


def template_po_approved_rejected(po_data: Dict, vendor_data: Dict, is_approved: bool, reason: str = None) -> tuple:
    """Email template when PO is approved or rejected"""
    
    if is_approved:
        subject = f"✅ Purchase Order Approved - {po_data.get('po_number')}"
        status_color = "#16a34a"
        status_text = "Approved"
        message = "Your purchase order has been approved. Please proceed with the delivery as scheduled."
    else:
        subject = f"❌ Purchase Order Rejected - {po_data.get('po_number')}"
        status_color = "#dc2626"
        status_text = "Rejected"
        message = "Unfortunately, your purchase order has been rejected."
        if reason:
            message += f"<br><br><strong>Reason:</strong> {reason}"
    
    content = f"""
    <h2 style="margin: 0 0 16px 0; color: {status_color}; font-size: 20px;">Purchase Order {status_text}</h2>
    
    <div style="background-color: {'#dcfce7' if is_approved else '#fee2e2'}; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: {'#166534' if is_approved else '#991b1b'}; font-weight: bold;">
            PO {po_data.get('po_number')} has been {status_text.lower()}
        </p>
    </div>
    
    <p style="color: #334155; line-height: 1.6;">Dear {vendor_data.get('name', 'Vendor')},</p>
    <p style="color: #334155; line-height: 1.6;">{message}</p>
    
    <div style="margin-top: 24px; text-align: center;">
        <a href="{APP_BASE_URL}/vendor/purchase-orders/{po_data.get('id')}" 
           style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Order
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


def template_issue_raised(issue_data: Dict, po_data: Dict, vendor_data: Dict) -> tuple:
    """Email template when an issue is raised"""
    subject = f"⚠️ Issue Raised - {issue_data.get('issue_number')} for PO {po_data.get('po_number')}"
    
    priority_colors = {
        'high': '#dc2626',
        'medium': '#ea580c',
        'low': '#0284c7'
    }
    priority = issue_data.get('priority', 'medium')
    priority_color = priority_colors.get(priority, '#ea580c')
    
    content = f"""
    <h2 style="margin: 0 0 16px 0; color: #ea580c; font-size: 20px;">Issue Reported</h2>
    
    <div style="background-color: #fff7ed; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid {priority_color};">
        <p style="margin: 0; color: #9a3412; font-weight: bold;">
            Issue #{issue_data.get('issue_number')}
        </p>
        <p style="margin: 8px 0 0 0; color: #9a3412;">
            Priority: <span style="text-transform: uppercase; font-weight: bold; color: {priority_color};">{priority}</span>
        </p>
    </div>
    
    <p style="color: #334155; line-height: 1.6;">Dear {vendor_data.get('name', 'Vendor')},</p>
    <p style="color: #334155; line-height: 1.6;">An issue has been raised regarding PO {po_data.get('po_number')}. Please review and respond promptly.</p>
    
    <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #475569;"><strong>Issue Type:</strong> {issue_data.get('issue_type', 'N/A').replace('_', ' ').title()}</p>
        <p style="margin: 12px 0 0 0; color: #475569;"><strong>Description:</strong></p>
        <p style="margin: 8px 0 0 0; color: #64748b;">{issue_data.get('description', 'N/A')}</p>
    </div>
    
    <div style="margin-top: 24px; text-align: center;">
        <a href="{APP_BASE_URL}/vendor/issues" 
           style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Issue Details
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


def template_payment_made(payment_data: Dict, invoice_data: Dict, vendor_data: Dict) -> tuple:
    """Email template when payment is made"""
    subject = f"💰 Payment Received - {format_currency(payment_data.get('amount', 0))}"
    
    content = f"""
    <h2 style="margin: 0 0 16px 0; color: #16a34a; font-size: 20px;">Payment Confirmation</h2>
    
    <div style="background-color: #dcfce7; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #166534; font-weight: bold; font-size: 24px;">
            {format_currency(payment_data.get('amount', 0))}
        </p>
        <p style="margin: 8px 0 0 0; color: #166534;">
            Payment processed successfully
        </p>
    </div>
    
    <p style="color: #334155; line-height: 1.6;">Dear {vendor_data.get('name', 'Vendor')},</p>
    <p style="color: #334155; line-height: 1.6;">A payment has been processed for your invoice. Details below:</p>
    
    <table width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
        <tr>
            <td style="padding: 8px 0; color: #64748b;">Invoice Number:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: bold;">{invoice_data.get('invoice_number', 'N/A')}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #64748b;">Payment Date:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: bold;">{format_date(payment_data.get('payment_date', 'N/A'))}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #64748b;">Payment Mode:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: bold;">{payment_data.get('payment_mode', 'N/A').upper()}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #64748b;">Reference:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: bold;">{payment_data.get('reference_number', 'N/A')}</td>
        </tr>
    </table>
    
    <div style="margin-top: 24px; text-align: center;">
        <a href="{APP_BASE_URL}/vendor/invoices" 
           style="display: inline-block; background-color: #16a34a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Invoices
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


# ========================
# ADMIN EMAIL TEMPLATES
# ========================

def template_admin_po_confirmed(po_data: Dict, vendor_data: Dict, admin_emails: List[str]) -> tuple:
    """Email template when vendor confirms a PO"""
    subject = f"✅ PO Confirmed by Vendor - {po_data.get('po_number')}"
    
    content = f"""
    <h2 style="margin: 0 0 16px 0; color: #16a34a; font-size: 20px;">Purchase Order Confirmed</h2>
    
    <div style="background-color: #dcfce7; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #166534; font-weight: bold;">
            PO {po_data.get('po_number')} has been confirmed by {vendor_data.get('name', 'the vendor')}
        </p>
    </div>
    
    <p style="color: #334155; line-height: 1.6;">The vendor has confirmed the purchase order and will proceed with fulfillment.</p>
    
    <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #475569;"><strong>Vendor:</strong> {vendor_data.get('name', 'N/A')}</p>
        <p style="margin: 12px 0 0 0; color: #475569;"><strong>Expected Delivery:</strong> {format_date(po_data.get('delivery_date', 'N/A'))}</p>
        <p style="margin: 12px 0 0 0; color: #475569;"><strong>Total Amount:</strong> {format_currency(po_data.get('grand_total', 0))}</p>
    </div>
    
    <div style="margin-top: 24px; text-align: center;">
        <a href="{APP_BASE_URL}/oll/purchase-orders/{po_data.get('id')}" 
           style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Order
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


def template_admin_dispatched(po_data: Dict, dispatch_data: Dict, vendor_data: Dict) -> tuple:
    """Email template when order is dispatched"""
    subject = f"📦 Order Dispatched - {po_data.get('po_number')}"
    
    content = f"""
    <h2 style="margin: 0 0 16px 0; color: #0284c7; font-size: 20px;">Order Dispatched</h2>
    
    <div style="background-color: #e0f2fe; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #0369a1; font-weight: bold;">
            PO {po_data.get('po_number')} has been dispatched
        </p>
        <p style="margin: 8px 0 0 0; color: #0369a1;">
            Expected Delivery: {format_date(dispatch_data.get('expected_delivery_date') or po_data.get('delivery_date', 'N/A'))}
        </p>
    </div>
    
    <p style="color: #334155; line-height: 1.6;">The vendor has dispatched the order. Details below:</p>
    
    <table width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
        <tr>
            <td style="padding: 8px 0; color: #64748b;">Vendor:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: bold;">{vendor_data.get('name', 'N/A')}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #64748b;">Dispatch Date:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: bold;">{format_date(dispatch_data.get('dispatch_date', 'N/A'))}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #64748b;">Vehicle Number:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: bold;">{dispatch_data.get('vehicle_number', 'N/A')}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #64748b;">Driver Contact:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: bold;">{dispatch_data.get('driver_contact', 'N/A')}</td>
        </tr>
    </table>
    
    <div style="margin-top: 24px; text-align: center;">
        <a href="{APP_BASE_URL}/oll/deliveries" 
           style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Track Deliveries
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


def template_admin_delivered(po_data: Dict, vendor_data: Dict) -> tuple:
    """Email template when delivery is submitted for approval"""
    subject = f"📬 Delivery Submitted for Approval - {po_data.get('po_number')}"
    
    content = f"""
    <h2 style="margin: 0 0 16px 0; color: #7c3aed; font-size: 20px;">Delivery Pending Approval</h2>
    
    <div style="background-color: #f3e8ff; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #6b21a8; font-weight: bold;">
            PO {po_data.get('po_number')} delivery requires your approval
        </p>
    </div>
    
    <p style="color: #334155; line-height: 1.6;">The vendor has marked the delivery as complete. Please review and approve or reject.</p>
    
    <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #475569;"><strong>Vendor:</strong> {vendor_data.get('name', 'N/A')}</p>
        <p style="margin: 12px 0 0 0; color: #475569;"><strong>Delivery Date:</strong> {format_date(po_data.get('delivery_date', 'N/A'))}</p>
        <p style="margin: 12px 0 0 0; color: #475569;"><strong>Delivery Address:</strong> {po_data.get('delivery_address', 'N/A')}</p>
    </div>
    
    <div style="margin-top: 24px; text-align: center;">
        <a href="{APP_BASE_URL}/oll/purchase-orders/{po_data.get('id')}" 
           style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Review & Approve
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


def template_admin_payment_due(invoice_data: Dict, vendor_data: Dict, days_until: int) -> tuple:
    """Email template for payment due reminders"""
    
    if days_until == 0:
        subject = f"🚨 Payment Due Today - Invoice {invoice_data.get('invoice_number')}"
        urgency_text = "is due TODAY"
    elif days_until < 0:
        subject = f"⚠️ Payment Overdue - Invoice {invoice_data.get('invoice_number')}"
        urgency_text = f"is OVERDUE by {abs(days_until)} days"
    else:
        subject = f"📅 Payment Due in {days_until} Days - Invoice {invoice_data.get('invoice_number')}"
        urgency_text = f"is due in {days_until} days"
    
    content = f"""
    <h2 style="margin: 0 0 16px 0; color: #ea580c; font-size: 20px;">Payment Reminder</h2>
    
    <div style="background-color: #fff7ed; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #9a3412; font-weight: bold;">
            Payment for Invoice {invoice_data.get('invoice_number')} {urgency_text}
        </p>
        <p style="margin: 8px 0 0 0; color: #9a3412; font-size: 24px; font-weight: bold;">
            {format_currency(invoice_data.get('total_amount', 0))}
        </p>
    </div>
    
    <table width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
        <tr>
            <td style="padding: 8px 0; color: #64748b;">Vendor:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: bold;">{vendor_data.get('name', 'N/A')}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #64748b;">Invoice Date:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: bold;">{format_date(invoice_data.get('invoice_date', 'N/A'))}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #64748b;">Due Amount:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: bold;">{format_currency(invoice_data.get('total_amount', 0) - invoice_data.get('paid_amount', 0))}</td>
        </tr>
    </table>
    
    <div style="margin-top: 24px; text-align: center;">
        <a href="{APP_BASE_URL}/oll/payments" 
           style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Process Payment
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


def template_admin_issue_resolution(issue_data: Dict, po_data: Dict, vendor_data: Dict) -> tuple:
    """Email template when an issue is resolved"""
    subject = f"✅ Issue Resolved - {issue_data.get('issue_number')}"
    
    content = f"""
    <h2 style="margin: 0 0 16px 0; color: #16a34a; font-size: 20px;">Issue Resolved</h2>
    
    <div style="background-color: #dcfce7; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #166534; font-weight: bold;">
            Issue #{issue_data.get('issue_number')} has been resolved
        </p>
    </div>
    
    <p style="color: #334155; line-height: 1.6;">The issue related to PO {po_data.get('po_number')} has been marked as resolved.</p>
    
    <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #475569;"><strong>Issue Type:</strong> {issue_data.get('issue_type', 'N/A').replace('_', ' ').title()}</p>
        <p style="margin: 12px 0 0 0; color: #475569;"><strong>Vendor:</strong> {vendor_data.get('name', 'N/A')}</p>
        <p style="margin: 12px 0 0 0; color: #475569;"><strong>Resolution:</strong></p>
        <p style="margin: 8px 0 0 0; color: #64748b;">{issue_data.get('resolution', 'Marked as resolved')}</p>
    </div>
    
    <div style="margin-top: 24px; text-align: center;">
        <a href="{APP_BASE_URL}/oll/issues" 
           style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Issues
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


# ========================
# EMAIL SENDING FUNCTIONS
# ========================

async def send_email_async(to_email: str, subject: str, html_content: str) -> bool:
    """
    Send email asynchronously without blocking the main request
    Returns True if email was sent successfully, False otherwise
    """
    if not EMAIL_ENABLED or not resend:
        logger.info(f"Email skipped (not configured): {subject} to {to_email}")
        return False
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        
        # Run sync SDK in thread to keep FastAPI non-blocking
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent successfully: {subject} to {to_email}, ID: {result.get('id')}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email: {subject} to {to_email}, Error: {str(e)}")
        return False


def send_email_background(to_email: str, subject: str, html_content: str):
    """
    Fire-and-forget email sending - doesn't block the caller
    Creates a background task to send the email
    """
    if not EMAIL_ENABLED or not resend:
        logger.info(f"Email skipped (not configured): {subject} to {to_email}")
        return
    
    try:
        # Create background task
        asyncio.create_task(send_email_async(to_email, subject, html_content))
        logger.info(f"Email queued for background sending: {subject} to {to_email}")
    except RuntimeError:
        # If no event loop is running, log and skip
        logger.warning(f"No event loop available for background email: {subject}")


async def send_bulk_emails_async(emails: List[Dict[str, str]]) -> Dict[str, int]:
    """
    Send multiple emails concurrently
    emails: List of dicts with 'to', 'subject', 'html' keys
    Returns: Dict with 'sent' and 'failed' counts
    """
    if not EMAIL_ENABLED or not resend:
        logger.info(f"Bulk email skipped (not configured): {len(emails)} emails")
        return {"sent": 0, "failed": len(emails)}
    
    results = await asyncio.gather(
        *[send_email_async(e['to'], e['subject'], e['html']) for e in emails],
        return_exceptions=True
    )
    
    sent = sum(1 for r in results if r is True)
    failed = len(results) - sent
    
    logger.info(f"Bulk email complete: {sent} sent, {failed} failed")
    return {"sent": sent, "failed": failed}


# ========================
# NOTIFICATION HELPER FUNCTIONS
# ========================

async def notify_vendor_po_raised(po_data: Dict, vendor_data: Dict):
    """Notify vendor when a new PO is raised"""
    if not vendor_data.get('email'):
        logger.warning(f"No email for vendor {vendor_data.get('id')} - skipping PO raised notification")
        return
    
    subject, html = template_po_raised(po_data, vendor_data)
    send_email_background(vendor_data['email'], subject, html)


async def notify_vendor_delivery_reminder(po_data: Dict, vendor_data: Dict, days_until: int):
    """Notify vendor about upcoming delivery"""
    if not vendor_data.get('email'):
        return
    
    subject, html = template_delivery_reminder(po_data, vendor_data, days_until)
    await send_email_async(vendor_data['email'], subject, html)


async def notify_vendor_po_status(po_data: Dict, vendor_data: Dict, is_approved: bool, reason: str = None):
    """Notify vendor when PO is approved or rejected"""
    if not vendor_data.get('email'):
        return
    
    subject, html = template_po_approved_rejected(po_data, vendor_data, is_approved, reason)
    send_email_background(vendor_data['email'], subject, html)


async def notify_vendor_issue_raised(issue_data: Dict, po_data: Dict, vendor_data: Dict):
    """Notify vendor when an issue is raised"""
    if not vendor_data.get('email'):
        return
    
    subject, html = template_issue_raised(issue_data, po_data, vendor_data)
    send_email_background(vendor_data['email'], subject, html)


async def notify_vendor_payment_made(payment_data: Dict, invoice_data: Dict, vendor_data: Dict):
    """Notify vendor when payment is made"""
    if not vendor_data.get('email'):
        return
    
    subject, html = template_payment_made(payment_data, invoice_data, vendor_data)
    send_email_background(vendor_data['email'], subject, html)


async def notify_admin_po_confirmed(po_data: Dict, vendor_data: Dict, admin_emails: List[str]):
    """Notify admin when vendor confirms a PO"""
    subject, html = template_admin_po_confirmed(po_data, vendor_data, admin_emails)
    
    for email in admin_emails:
        send_email_background(email, subject, html)


async def notify_admin_dispatched(po_data: Dict, dispatch_data: Dict, vendor_data: Dict, admin_emails: List[str]):
    """Notify admin when order is dispatched"""
    subject, html = template_admin_dispatched(po_data, dispatch_data, vendor_data)
    
    for email in admin_emails:
        send_email_background(email, subject, html)


async def notify_admin_delivered(po_data: Dict, vendor_data: Dict, admin_emails: List[str]):
    """Notify admin when delivery is submitted for approval"""
    subject, html = template_admin_delivered(po_data, vendor_data)
    
    for email in admin_emails:
        send_email_background(email, subject, html)


async def notify_admin_payment_due(invoice_data: Dict, vendor_data: Dict, admin_emails: List[str], days_until: int):
    """Notify admin about payment due"""
    subject, html = template_admin_payment_due(invoice_data, vendor_data, days_until)
    
    for email in admin_emails:
        await send_email_async(email, subject, html)


async def notify_admin_issue_resolved(issue_data: Dict, po_data: Dict, vendor_data: Dict, admin_emails: List[str]):
    """Notify admin when an issue is resolved"""
    subject, html = template_admin_issue_resolution(issue_data, po_data, vendor_data)
    
    for email in admin_emails:
        send_email_background(email, subject, html)


# ========================
# UTILITY FUNCTIONS
# ========================

async def get_admin_emails(db) -> List[str]:
    """Get all admin user emails from database"""
    try:
        admins = await db.users.find(
            {"role": "oll", "is_active": True},
            {"_id": 0, "email": 1}
        ).to_list(100)
        return [a['email'] for a in admins if a.get('email')]
    except Exception as e:
        logger.error(f"Failed to get admin emails: {e}")
        return []


def is_email_configured() -> bool:
    """Check if email service is configured"""
    return EMAIL_ENABLED
