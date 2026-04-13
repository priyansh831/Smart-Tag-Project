import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from 'resend';
import twilio from 'twilio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) 
  : null;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Notification endpoint (SMS + Email)
  app.post("/api/notify", async (req, res) => {
    const { vehicleId, type, message, ownerEmail, ownerPhone } = req.body;
    
    console.log(`\n--- [NOTIFICATION TRIGGERED] ---`);
    console.log(`To Vehicle: ${vehicleId}`);
    console.log(`Type: ${type}`);
    console.log(`Message: ${message}`);
    console.log(`Owner Email: ${ownerEmail}`);
    console.log(`Owner Phone: ${ownerPhone}`);

    let emailSent = false;
    let smsSent = false;
    let emailError = null;
    let smsError = null;

    // 1. Handle Email via Resend
    if (resend && ownerEmail) {
      try {
        const { data, error } = await resend.emails.send({
          from: 'SmartTag <onboarding@resend.dev>',
          to: [ownerEmail],
          subject: `[SmartTag Alert] ${type.toUpperCase()}: ${vehicleId}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 4px solid black; background: #fef08a;">
              <h1 style="text-transform: uppercase; font-weight: 900; margin-bottom: 10px;">Vehicle Alert</h1>
              <p style="font-size: 18px; font-weight: bold;">${message}</p>
              <hr style="border: 1px solid black;" />
              <p style="font-size: 12px; font-weight: bold; text-transform: uppercase; opacity: 0.6;">
                Vehicle ID: ${vehicleId} | Type: ${type}
              </p>
              <a href="${process.env.APP_URL}/dashboard" style="display: inline-block; background: black; color: #fef08a; padding: 10px 20px; text-decoration: none; font-weight: 900; margin-top: 20px;">
                VIEW DASHBOARD
              </a>
            </div>
          `
        });

        if (error) {
          emailError = error;
          console.error("Resend Error:", error);
        } else {
          emailSent = true;
          console.log("Email sent successfully via Resend:", data?.id);
        }
      } catch (err) {
        emailError = err;
        console.error("Failed to send email:", err);
      }
    }

    // 2. Handle SMS via Twilio
    if (twilioClient && ownerPhone && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const smsResponse = await twilioClient.messages.create({
          body: `[SmartTag Alert] ${type.toUpperCase()}: ${message}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: ownerPhone
        });
        smsSent = true;
        console.log("SMS sent successfully via Twilio:", smsResponse.sid);
      } catch (err) {
        smsError = err;
        console.error("Twilio Error:", err);
      }
    }

    if (!resend && !twilioClient) {
      console.log("[MOCK] No API Keys configured. Logging to console only.");
    }
    
    console.log(`--------------------------------\n`);
    
    res.json({ 
      success: true, 
      emailSent,
      smsSent,
      emailError,
      smsError,
      message: (emailSent || smsSent) ? "Notifications dispatched" : "Notifications logged to console (Mock)" 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error("Error sending index.html:", err);
          res.status(500).send("Build files missing. Please check if 'npm run build' succeeded.");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
