const defaultSubject =
  'Thank You for Scheduling Your Consultation - Khanna Vision Institute';

function build(bookingData, zohoFormUrl) {
  const text = `Thank you for scheduling your consultation with Khanna Vision Institute!

Your booking details:
- Name: ${bookingData.fullName || '—'}
- Age: ${bookingData.age || '—'}
- Email: ${bookingData.email || '—'}
- Phone: ${bookingData.phone || '—'}
- Location: ${bookingData.location || '—'}
- Preferred Date: ${bookingData.date || '—'}
- Preferred Time: ${bookingData.time || '—'}

To complete your registration, please fill out our detailed consultation form. Your information has been pre-filled for your convenience:

${zohoFormUrl}

While you wait for your appointment, take a look at the books written by Dr. Khanna: https://khannainstitute.com/about/dr-khanna/books/

We look forward to seeing you soon!

Best regards,
Khanna Vision Institute`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #ffffff;
          padding: 30px;
          border: 1px solid #e5e7eb;
          border-top: none;
          border-radius: 0 0 8px 8px;
        }
        .booking-details {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .booking-details p {
          margin: 8px 0;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%);
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 20px 0;
          text-align: center;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Thank You for Scheduling!</h1>
      </div>
      <div class="content">
        <p>Dear ${bookingData.fullName || 'Valued Patient'},</p>
        
        <p>Thank you for scheduling your consultation with Khanna Vision Institute. We're excited to help you on your journey to better vision!</p>
        
        <div class="booking-details">
          <p><strong>Your Booking Details:</strong></p>
          <p><strong>Name:</strong> ${bookingData.fullName || '—'}</p>
          <p><strong>Age:</strong> ${bookingData.age || '—'}</p>
          <p><strong>Email:</strong> ${bookingData.email || '—'}</p>
          <p><strong>Phone:</strong> ${bookingData.phone || '—'}</p>
          <p><strong>Location:</strong> ${bookingData.location || '—'}</p>
          <p><strong>Preferred Date:</strong> ${bookingData.date || '—'}</p>
          <p><strong>Preferred Time:</strong> ${bookingData.time || '—'}</p>
        </div>
        
        <p>To complete your registration and help us prepare for your visit, please fill out our detailed consultation form. We've pre-filled your information to make it quick and easy:</p>
        
        <div style="text-align: center;">
          <a href="${zohoFormUrl}" class="cta-button">Complete Your Registration Form</a>
        </div>
        
        <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:<br>
        <a href="${zohoFormUrl}" style="color: #3b82f6; word-break: break-all;">${zohoFormUrl}</a></p>
        
        <p>Our team will contact you within 24 hours to confirm your appointment. We look forward to seeing you soon!</p>
        
        <p>While you wait for your appointment, take a look at the books written by Dr. Khanna: <a href="https://khannainstitute.com/about/dr-khanna/books/" style="color: #3b82f6; text-decoration: none;">View Dr. Khanna's Books</a></p>
        
        <div class="footer">
          <p>Best regards,<br>
          <strong>Khanna Vision Institute</strong></p>
          <p>Beverly Hills & Westlake Village, California</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { text, html };
}

module.exports = { defaultSubject, build };
