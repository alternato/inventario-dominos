const app = require('./app');

const PORT = process.env.PORT || 8081;

app.listen(PORT, () => {
  console.log(`[server] Escuchando en puerto ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
