import express, { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../utils/emailService';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  category: z.enum(['general', 'order', 'payment', 'product', 'technical', 'complaint']).default('general'),
});

const newsletterSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstName: z.string().optional(),
});

/**
 * @swagger
 * /api/contact/send:
 *   post:
 *     summary: Send contact form message
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - subject
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [general, order, payment, product, technical, complaint]
 *     responses:
 *       200:
 *         description: Contact message sent successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Internal server error
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, subject, message, category } = contactSchema.parse(req.body);

    // Save contact message to database
    const contactMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        phone,
        subject,
        message,
        category,
        status: 'NEW',
      },
    });

    // Send email to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@definestrength.com';
    const adminSubject = `New Contact Message: ${subject}`;
    const adminHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #007bff 0%, #6610f2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .message-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff; }
          .info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📩 New Contact Message</h1>
            <p>Category: ${category.toUpperCase()}</p>
          </div>
          <div class="content">
            <div class="info">
              <h3>Contact Details</h3>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Category:</strong> ${category}</p>
              <p><strong>Message ID:</strong> ${contactMessage.id}</p>
            </div>
            
            <div class="message-box">
              <h3>Message</h3>
              <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            
            <p><strong>Action Required:</strong> Please respond to this inquiry within 24 hours.</p>
          </div>
          <div class="footer">
            <p>© 2025 Define Strength. All rights reserved.</p>
            <p>Contact message received on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: adminEmail,
      subject: adminSubject,
      html: adminHtml,
    });

    // Send confirmation email to user
    const userSubject = 'We received your message - Define Strength';
    const userHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .message-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Message Received!</h1>
            <p>Thank you for contacting Define Strength</p>
          </div>
          <div class="content">
            <h2>Hi ${name}!</h2>
            <p>We've received your message and will get back to you within 24 hours.</p>
            
            <div class="message-box">
              <h3>Your Message Summary</h3>
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Category:</strong> ${category}</p>
              <p><strong>Reference ID:</strong> ${contactMessage.id.slice(-8)}</p>
            </div>
            
            <p>Our support team is reviewing your inquiry. If you have any urgent concerns, please call us directly.</p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Visit Our Website</a>
            
            <p>Thank you for choosing Define Strength for your fitness equipment needs!</p>
          </div>
          <div class="footer">
            <p>© 2025 Define Strength. All rights reserved.</p>
            <p>Support email sent to ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: email,
      subject: userSubject,
      html: userHtml,
    });

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you within 24 hours.',
      reference: contactMessage.id.slice(-8),
    });
  } catch (error) {
    console.error('Contact form error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid form data',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again.',
    });
  }
});

/**
 * @swagger
 * /api/contact/newsletter/subscribe:
 *   post:
 *     summary: Subscribe to newsletter
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *               firstName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully subscribed to newsletter
 *       400:
 *         description: Invalid email or already subscribed
 *       500:
 *         description: Internal server error
 */
router.post('/newsletter/subscribe', async (req: Request, res: Response) => {
  try {
    const { email, firstName } = newsletterSchema.parse(req.body);

    // Check if already subscribed
    const existingSubscription = await prisma.newsletterSubscription.findUnique({
      where: { email },
    });

    if (existingSubscription) {
      if (existingSubscription.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Email is already subscribed to our newsletter.',
        });
      } else {
        // Reactivate subscription
        await prisma.newsletterSubscription.update({
          where: { email },
          data: { 
            isActive: true,
            firstName: firstName || existingSubscription.firstName,
            updatedAt: new Date(),
          },
        });
      }
    } else {
      // Create new subscription
      await prisma.newsletterSubscription.create({
        data: {
          email,
          firstName,
          isActive: true,
        },
      });
    }

    // Send welcome newsletter email
    const subject = 'Welcome to Define Strength Newsletter!';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #e83e8c 0%, #fd7e14 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .highlight { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
          .button { display: inline-block; background: #e83e8c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Welcome to Our Newsletter!</h1>
            <p>Stay updated with Define Strength</p>
          </div>
          <div class="content">
            <h2>Hi ${firstName || 'Fitness Enthusiast'}!</h2>
            <p>Thank you for subscribing to the Define Strength newsletter!</p>
            
            <div class="highlight">
              <h3>🎯 What to Expect</h3>
              <ul>
                <li>🆕 New product launches and releases</li>
                <li>💰 Exclusive discounts and offers</li>
                <li>💪 Fitness tips and workout guides</li>
                <li>📦 Order updates and delivery notifications</li>
                <li>🏆 Success stories from our community</li>
              </ul>
            </div>
            
            <p>Be the first to know about our latest fitness equipment, special promotions, and expert fitness advice.</p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Shop Now</a>
            
            <p>Welcome to the Define Strength family!</p>
            
            <p style="font-size: 12px; color: #666;">
              You can unsubscribe at any time by clicking the unsubscribe link in our emails.
            </p>
          </div>
          <div class="footer">
            <p>© 2025 Define Strength. All rights reserved.</p>
            <p>Newsletter subscription for ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: email,
      subject,
      html,
    });

    res.status(200).json({
      success: true,
      message: 'Successfully subscribed to our newsletter! Check your email for confirmation.',
    });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again.',
    });
  }
});

/**
 * @swagger
 * /api/contact/newsletter/unsubscribe:
 *   post:
 *     summary: Unsubscribe from newsletter
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully unsubscribed from newsletter
 *       400:
 *         description: Email not found or already unsubscribed
 *       500:
 *         description: Internal server error
 */
router.post('/newsletter/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const subscription = await prisma.newsletterSubscription.findUnique({
      where: { email },
    });

    if (!subscription) {
      return res.status(400).json({
        success: false,
        message: 'Email not found in our newsletter list.',
      });
    }

    if (!subscription.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Email is already unsubscribed.',
      });
    }

    // Deactivate subscription
    await prisma.newsletterSubscription.update({
      where: { email },
      data: { 
        isActive: false,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from our newsletter.',
    });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again.',
    });
  }
});

export default router;
