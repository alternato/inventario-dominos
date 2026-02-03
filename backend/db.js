const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const mockdb = require('./mockdb');

let supabase = null;
let useMock = false;

// Detectar si las credenciales de Supabase son válidas
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY && !process.env.SUPABASE_KEY.includes('...')) {
  try {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    console.log('✓ Conectado a Supabase');
  } catch (error) {
    console.log('⚠️  Supabase no configurado, usando mock database');
    useMock = true;
  }
} else {
  console.log('⚠️  Credenciales de Supabase incompletas, usando mock database');
  useMock = true;
}

// ===== USUARIOS =====
const getUsuarioByEmail = async (email) => {
  if (useMock) {
    return mockdb.usuarios.find(u => u.email === email) || null;
  }
  
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

const createUsuario = async (email, nombre, password, rol = 'viewer') => {
  const hashedPassword = await bcrypt.hash(password, 10);
  
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
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

const updatePasswordReset = async (email, token, expiresAt) => {
  const { error } = await supabase
    .from('usuarios')
    .update({
      reset_token: token,
      reset_token_expires: expiresAt
    })
    .eq('email', email);
  
  if (error) throw error;
};

const resetPassword = async (token, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  const { data, error } = await supabase
    .from('usuarios')
    .update({
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null
    })
    .eq('reset_token', token)
    .gt('reset_token_expires', new Date())
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// ===== ACTIVOS =====
const getActivos = async () => {
  if (useMock) {
    return mockdb.activos;
  }
  
  const { data, error } = await supabase
    .from('activos')
    .select(`
      *,
      colaborador:rut_responsable(nombre, correo)
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

const getActivoBySerie = async (serie) => {
  const { data, error } = await supabase
    .from('activos')
    .select(`
      *,
      colaborador:rut_responsable(nombre, correo)
    `)
    .eq('serie', serie)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

const createActivo = async (activoData) => {
  const { data, error } = await supabase
    .from('activos')
    .insert([
      {
        ...activoData,
        created_at: new Date()
      }
    ])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

const updateActivo = async (serie, activoData) => {
  const { data, error } = await supabase
    .from('activos')
    .update({
      ...activoData,
      updated_at: new Date()
    })
    .eq('serie', serie)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

const deleteActivo = async (serie) => {
  const { error } = await supabase
    .from('activos')
    .delete()
    .eq('serie', serie);
  
  if (error) throw error;
};

// ===== COLABORADORES =====
const getColaboradores = async () => {
  if (useMock) {
    return mockdb.colaboradores;
  }
  
  const { data, error } = await supabase
    .from('colaboradores')
    .select('*')
    .order('nombre', { ascending: true });
  
  if (error) throw error;
  return data;
};

const getColaboradorByRut = async (rut) => {
  const { data, error } = await supabase
    .from('colaboradores')
    .select('*')
    .eq('rut', rut)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

const createColaborador = async (colaboradorData) => {
  const { data, error } = await supabase
    .from('colaboradores')
    .insert([
      {
        ...colaboradorData,
        created_at: new Date()
      }
    ])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

const updateColaborador = async (rut, colaboradorData) => {
  const { data, error } = await supabase
    .from('colaboradores')
    .update({
      ...colaboradorData,
      updated_at: new Date()
    })
    .eq('rut', rut)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

module.exports = {
  supabase,
  getUsuarioByEmail,
  createUsuario,
  updatePasswordReset,
  resetPassword,
  getActivos,
  getActivoBySerie,
  createActivo,
  updateActivo,
  deleteActivo,
  getColaboradores,
  getColaboradorByRut,
  createColaborador,
  updateColaborador
};
