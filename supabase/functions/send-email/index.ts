const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { to, subject, html, text, smtpConfig } = body;

    if (!to || !subject || !html) {
      throw new Error("Missing required fields");
    }

    if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.password) {
      throw new Error("Invalid SMTP configuration");
    }

    const nodemailer = await import("npm:nodemailer@6.9.7");

    const transporter = nodemailer.default.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port || 587,
      secure: smtpConfig.secure || false,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password,
      },
    });

    const info = await transporter.sendMail({
      from: `"${smtpConfig.senderName || 'Administratie'}" <${smtpConfig.senderEmail}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ""),
      html,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});