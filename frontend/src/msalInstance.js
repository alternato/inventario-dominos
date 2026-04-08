import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./authConfig";

let msalInstance = null;
let initializationPromise = null;

export const getMsalInstance = async () => {
    if (!msalInstance) {
        msalInstance = new PublicClientApplication(msalConfig);
    }

    if (!initializationPromise) {
        initializationPromise = msalInstance.initialize().then(() => {
            console.log("MSAL Initialized successfully");
            return msalInstance;
        }).catch((e) => {
            initializationPromise = null; // Reintentar si falla
            throw e;
        });
    }

    await initializationPromise;
    return msalInstance;
};

// Por compatibilidad con archivos existentes que importan el default
export default msalInstance;
