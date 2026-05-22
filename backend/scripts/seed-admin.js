/**
 * Script para crear usuario admin inicial
 * 
 * Uso:
 * node seed-admin.js
 * 
 * Esto creará un usuario admin en la base de datos Supabase
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const createAdminUser = async () => {
  try {
    console.log('\n📝 Creando usuario administrador...\n');

    const email = 'admin@dominospizza.cl';
    const password = 'AdminDominos2026'; // Cambiar después del primer login
    const nombre = 'Administrador Sistema';
    const rol = 'admin';

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const { data, error } = await supabase
      .from('usuarios')
      .insert([
        {
          email,
          nombre,
          password: hashedPassword,
          rol,
          activo: true,
          created_at: new Date()
        }
      ])
      .select();

    if (error) {
      if (error.code === '23505') {
        console.log('⚠️  El usuario admin ya existe en la base de datos.\n');
        return;
      }
      throw error;
    }

    console.log('✅ Usuario administrador creado exitosamente!\n');
    console.log('📋 Credenciales de acceso:');
    console.log('────────────────────────────────────────');
    console.log(`📧 Email:      ${email}`);
    console.log(`🔑 Contraseña: ${password}`);
    console.log('────────────────────────────────────────');
    console.log('\n⚠️  IMPORTANTE:');
    console.log('   1. Anota estas credenciales en un lugar seguro');
    console.log('   2. Cambia la contraseña después del primer login');
    console.log('   3. No compartas estas credenciales por email\n');

  } catch (error) {
    console.error('❌ Error al crear usuario admin:', error.message);
    process.exit(1);
  }
};

// Ejecutar
createAdminUser();
