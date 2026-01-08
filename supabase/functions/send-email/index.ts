import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    senderName: string;
    senderEmail: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    console.log("Content-Type:", contentType);
    console.log("Method:", req.method);
    
    if (!contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid Content-Type",
          received: contentType,
          expected: "application/json"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error("JSON parse error:", parseError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to parse request body",
          details: parseError.message
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { to, subject, html, text, smtpConfig }: EmailRequest = body;

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.password) {
      return new Response(
        JSON.stringify({ error: "Invalid SMTP configuration" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Importing nodemailer...");
    const nodemailer = await import("npm:nodemailer@6.9.7");

    console.log("Creating transporter...");
    const transporter = nodemailer.default.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password,
      },
    });

    const mailOptions = {
      from: `\"${smtpConfig.senderName}\" <${smtpConfig.senderEmail}>`,
      to: to,
      subject: subject,
      text: text || html.replace(/<[^>]*>/g, ""),
      html: html,
    };

    console.log("Sending email to:", to);
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
        message: "Email sent successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to send email",
        details: error.toString(),
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});