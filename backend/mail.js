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
          <h2 style="color: #0066CC; text-align: center;">IT COMPASS - Domino's Pizza Chile</h2>
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

const sendStatusEventAlert = async (activoInfo, estadoAnterior, estadoNuevo, adminEmail) => {
  const htmlContent = `
    <html dir="ltr" lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Alerta de Inventario - Cambio Crítico de Estado</title>
      </head>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          <h2 style="color: #ea4335; text-align: center;">IT COMPASS - Alerta Crítica</h2>
          <h3>El equipo ${activoInfo.serie} ha cambiado su estado a <strong>${estadoNuevo}</strong>.</h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Serie/IMEI:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${activoInfo.serie} ${activoInfo.imei ? `(IMEI: ${activoInfo.imei})` : ''}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Equipo:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${activoInfo.tipo_dispositivo} - ${activoInfo.marca} ${activoInfo.modelo}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Estado Anterior:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${estadoAnterior}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Nuevo Estado:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd; color: #ea4335; font-weight: bold;">${estadoNuevo}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Ubicación/Área:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${activoInfo.ubicacion || 'No especificada'}</td></tr>
          </table>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/activos" style="background: #ea4335; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">
              Revisar Inventario Web
            </a>
          </div>

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
    to: adminEmail,
    subject: `⚠️ Alerta: Equipo en estado ${estadoNuevo} (${activoInfo.serie})`,
    html: htmlContent
  });
};

const sendMissingSignatureAlert = async (activoInfo, colaboradorInfo, adminEmail) => {
  const htmlContent = `
    <html dir="ltr" lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Alerta Administrativa - Firma Pendiente</title>
      </head>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); border-top: 5px solid #f59e0b;">
          <h2 style="color: #d97706; text-align: center;">IT COMPASS - Gestión Documental Pendiente</h2>
          <p>El siguiente equipo ha sido devuelto (desasignado), pero se indicó que <strong>falta la firma del documento de recepción/devolución</strong> por parte del colaborador.</p>
          
          <h4 style="margin-bottom: 5px; color: #4b5563; border-bottom: 1px solid #eee; padding-bottom: 5px;">Detalles del Colaborador</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 5px;"><strong>Nombre:</strong></td><td style="padding: 5px;">${colaboradorInfo?.nombre || 'No especificado'}</td></tr>
            <tr><td style="padding: 5px;"><strong>RUT:</strong></td><td style="padding: 5px;">${colaboradorInfo?.rut || 'Sin RUT'}</td></tr>
            <tr><td style="padding: 5px;"><strong>Área / Cargo:</strong></td><td style="padding: 5px;">${colaboradorInfo?.area || ''} / ${colaboradorInfo?.cargo || ''}</td></tr>
          </table>

          <h4 style="margin-bottom: 5px; color: #4b5563; border-bottom: 1px solid #eee; padding-bottom: 5px;">Detalles del Equipo</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 5px;"><strong>Equipo:</strong></td><td style="padding: 5px;">${activoInfo?.tipo_dispositivo || ''} ${activoInfo?.marca || ''} ${activoInfo?.modelo || ''}</td></tr>
            <tr><td style="padding: 5px;"><strong>Serie:</strong></td><td style="padding: 5px; font-family: monospace;">${activoInfo?.serie || ''}</td></tr>
          </table>

          <div style="text-align: center; margin: 30px 0; background: #fffbeb; border: 1px solid #fde68a; padding: 15px; border-radius: 8px;">
            <p style="color: #b45309; margin: 0;">Es responsabilidad del departamento contactar de inmediato a esta persona para formalizar la firma y evitar confusiones en los cobros de finiquito o responsabilidad técnica.</p>
          </div>

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
    to: adminEmail,
    subject: `⚠️ Acción Requerida: Falta firma de devolución de ${colaboradorInfo?.nombre || 'Colaborador'}`,
    html: htmlContent
  });
};

// ──────────────────────────────────────────────────────────────
// Email informativo a RRHH cuando se crea una asignación
// ──────────────────────────────────────────────────────────────
const sendMailAsignacion = async ({ colaborador, activo, entregadoPor, fecha }) => {
  const fechaFmt = fecha
    ? new Date(fecha).toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' })
    : new Date().toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' });

  const htmlContent = `
    <html dir="ltr" lang="es">
      <head><meta charset="UTF-8"><title>Asignación de Equipo - IT COMPASS</title></head>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); border-top: 5px solid #0066CC;">
          <h2 style="color: #0066CC; text-align: center; margin-bottom: 5px;">IT COMPASS</h2>
          <p style="text-align:center; color:#666; font-size:13px; margin-top:0;">Domino's Pizza Chile — Departamento de TI</p>
          <hr style="border:none; border-top:1px solid #eee; margin: 20px 0;">

          <h3 style="color:#1e293b;">📦 Nueva Asignación de Equipo</h3>
          <p style="color:#475569; font-size:14px;">Se ha registrado la siguiente asignación en el sistema de inventario:</p>

          <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:14px;">
            <tr style="background:#f8fafc;">
              <td style="padding:10px 14px; font-weight:bold; color:#64748b; width:40%;">👤 Colaborador</td>
              <td style="padding:10px 14px; color:#1e293b;">${colaborador.nombre}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px; font-weight:bold; color:#64748b;">🪪 RUT</td>
              <td style="padding:10px 14px; color:#1e293b; font-family:monospace;">${colaborador.rut}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:10px 14px; font-weight:bold; color:#64748b;">🏢 Área</td>
              <td style="padding:10px 14px; color:#1e293b;">${colaborador.area || '—'}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px; font-weight:bold; color:#64748b;">💻 Equipo</td>
              <td style="padding:10px 14px; color:#1e293b;">${activo.tipo_dispositivo} — ${activo.marca} ${activo.modelo}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:10px 14px; font-weight:bold; color:#64748b;">🔢 Serie</td>
              <td style="padding:10px 14px; color:#1e293b; font-family:monospace;">${activo.serie}</td>
            </tr>
            ${activo.imei ? `<tr><td style="padding:10px 14px; font-weight:bold; color:#64748b;">📱 IMEI</td><td style="padding:10px 14px; color:#1e293b; font-family:monospace;">${activo.imei}</td></tr>` : ''}
            <tr>
              <td style="padding:10px 14px; font-weight:bold; color:#64748b;">📅 Fecha</td>
              <td style="padding:10px 14px; color:#1e293b;">${fechaFmt}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:10px 14px; font-weight:bold; color:#64748b;">👷 Entregado por</td>
              <td style="padding:10px 14px; color:#1e293b;">${entregadoPor || 'TI'}</td>
            </tr>
          </table>

          <p style="font-size:12px; color:#94a3b8; text-align:center; margin-top:30px;">
            Este correo es informativo. No requiere respuesta.<br>
            © 2026 Domino's Pizza Chile — Departamento de TI
          </p>
        </div>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: 'rrhh@dominospizza.cl',
    subject: `[TI] Asignación de equipo — ${colaborador.nombre} (${fechaFmt})`,
    html: htmlContent,
  });
};

// ──────────────────────────────────────────────────────────────
// Email con link de confirmación de devolución al colaborador
// ──────────────────────────────────────────────────────────────
const sendMailConfirmacionDevolucion = async ({ colaborador, activo, token, emailDestino, viaPersonal }) => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8081';
  const confirmLink = `${backendUrl}/api/asignaciones/confirmar/${token}`;
  const expira = new Date(Date.now() + 72 * 60 * 60 * 1000)
    .toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

  const htmlContent = `
    <html dir="ltr" lang="es">
      <head><meta charset="UTF-8"><title>Confirma tu devolución — IT COMPASS</title></head>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); border-top: 5px solid #f97316;">
          <h2 style="color: #f97316; text-align: center; margin-bottom: 5px;">IT COMPASS</h2>
          <p style="text-align:center; color:#666; font-size:13px; margin-top:0;">Domino's Pizza Chile — Departamento de TI</p>
          <hr style="border:none; border-top:1px solid #eee; margin: 20px 0;">

          <h3 style="color:#1e293b;">Hola, ${colaborador.nombre.split(' ')[0]}.</h3>
          <p style="color:#475569; font-size:14px; line-height:1.6;">
            El equipo de TI ha registrado la <strong>devolución</strong> del siguiente equipo a tu nombre.
            Para completar el proceso, por favor confirma haciendo clic en el botón a continuación:
          </p>

          <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:14px; background:#fff7ed; border-radius:8px; overflow:hidden;">
            <tr>
              <td style="padding:10px 14px; font-weight:bold; color:#9a3412; width:40%;">💻 Equipo</td>
              <td style="padding:10px 14px; color:#431407;">${activo.tipo_dispositivo} — ${activo.marca} ${activo.modelo}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px; font-weight:bold; color:#9a3412;">🔢 Serie</td>
              <td style="padding:10px 14px; color:#431407; font-family:monospace;">${activo.serie}</td>
            </tr>
          </table>

          <div style="text-align:center; margin: 30px 0;">
            <a href="${confirmLink}"
               style="background:#f97316; color:white; padding:14px 36px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px; display:inline-block;">
              ✓ Confirmar Devolución
            </a>
          </div>

          <p style="font-size:12px; color:#94a3b8; text-align:center;">
            Este link expira el ${expira}.<br>
            Si no reconoces esta devolución, comunícate con el Departamento de TI.<br><br>
            © 2026 Domino's Pizza Chile — Departamento de TI
          </p>
        </div>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: emailDestino,
    subject: `Confirma la devolución de tu equipo — ${activo.marca} ${activo.modelo}`,
    html: htmlContent,
  });
};

module.exports = {

  sendPasswordResetEmail,
  sendStatusEventAlert,
  sendMissingSignatureAlert,
  sendMailAsignacion,
  sendMailConfirmacionDevolucion,
};

