const app = require('./app');
const { iniciarLimpiezaSesiones } = require('./middleware');

const PORT = process.env.PORT || 8081;

app.listen(PORT, () => {
  console.log(`[server] Escuchando en puerto ${PORT} (${process.env.NODE_ENV || 'development'})`);
  // Limpieza periódica de la denylist de sesiones revocadas (Req. 11.5).
  iniciarLimpiezaSesiones();
});
