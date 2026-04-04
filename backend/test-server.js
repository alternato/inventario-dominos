const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

// Mock usuario
const adminPassword = bcrypt.hashSync('AdminDominos2026', 10);
const mockUser = {
  id: 1,
  email: 'admin@dominospizza.cl',
  nombre: 'Administrador TI',
  password: adminPassword,
  rol: 'admin',
  activo: true
};

// Login simple
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('📥 Recibido:', req.body);
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    
    if (email !== mockUser.email) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, mockUser.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    
    const token = jwt.sign(
      {
        id: mockUser.id,
        email: mockUser.email,
        nombre: mockUser.nombre,
        rol: mockUser.rol
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '8h' }
    );
    
    console.log('✓ Login exitoso');
    res.json({
      message: 'Login exitoso',
      token,
      usuario: {
        id: mockUser.id,
        email: mockUser.email,
        nombre: mockUser.nombre,
        rol: mockUser.rol
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server running' });
});

app.listen(8080, () => {
  console.log('🚀 Test server running on port 8080');
});
