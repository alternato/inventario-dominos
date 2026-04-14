import { useState, useEffect } from 'react';
import { getMsalInstance } from '../msalInstance';

/**
 * MicrosoftPhoto: Obtiene y muestra la foto de perfil desde Microsoft Graph
 * @param {string} email - Correo del colaborador (userPrincipalName)
 * @param {string} nombre - Nombre para las iniciales en caso de error
 * @param {string} className - Clases de Tailwind para el diseño
 */
export const MicrosoftPhoto = ({ email, nombre, className = "" }) => {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!email || !email.endsWith('@dominospizza.cl')) {
      setLoading(false);
      setError(true);
      return;
    }

    const fetchPhoto = async () => {
      try {
        const msal = await getMsalInstance();
        const accounts = msal.getAllAccounts();
        
        if (accounts.length === 0) throw new Error("No hay sesión activa");

        // Intentar obtener token para Microsoft Graph
        const tokenResponse = await msal.acquireTokenSilent({
          scopes: ["User.ReadBasic.All"],
          account: accounts[0]
        });

        // Llamar a la API de Microsoft Graph para la foto
        const response = await fetch(
          `https://graph.microsoft.com/v1.0/users/${email}/photo/$value`,
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.accessToken}`
            }
          }
        );

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setPhotoUrl(url);
        } else {
          setError(true);
        }
      } catch (err) {
        console.warn(`No se pudo cargar foto para ${email}:`, err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPhoto();

    // Limpiar el objeto URL para evitar memory leaks
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [email]);

  const iniciales = nombre?.charAt(0).toUpperCase() || '?';

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 animate-pulse ${className}`}>
        <div className="w-1/2 h-1/2 bg-gray-200 rounded-full" />
      </div>
    );
  }

  if (error || !photoUrl) {
    return (
      <div className={`flex items-center justify-center bg-primary text-white font-bold ${className}`}>
        {iniciales}
      </div>
    );
  }

  return (
    <img 
      src={photoUrl} 
      alt={nombre} 
      className={`object-cover ${className}`}
      onError={() => setError(true)}
    />
  );
};
