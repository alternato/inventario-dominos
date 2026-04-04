const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

const sendPasswordResetEmail = async (email, resetToken, nombre) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const htmlContent = `
    <html dir="ltr" lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Recuperación de Contraseña - Inventario TI Domino's</title>
      </head>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          <h2 style="color: #0066CC; text-align: center;">TI Maestro - Domino's Pizza Chile</h2>
          <h3>Recuperación de Contraseña</h3>
          <p>Hola ${nombre},</p>
          <p>Recibimos una solicitud para recuperar tu contraseña. Haz clic en el siguiente enlace para restablecerla:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #0066CC; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">
              Recuperar Contraseña
            </a>
          </div>
          <p>O copia este enlace en tu navegador:</p>
          <p style="background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">
            ${resetLink}
          </p>
          <p><strong>⚠️ Nota:</strong> Este enlace expira en 1 hora.</p>
          <p>Si no solicitaste esta recuperación, ignora este email.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="text-align: center; font-size: 12px; color: #666;">
            © 2026 Domino's Pizza Chile - Departamento de TI<br>
            Este email es automático, no responder.
          </p>
        </div>
      </body>
    </html>
  `;
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Recuperación de Contraseña - Inventario TI Domino\'s',
    html: htmlContent
  });
};

module.exports = {
  sendPasswordResetEmail
};
