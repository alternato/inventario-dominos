import { LogLevel } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: "4361c762-9ecd-4da0-b136-dafcbb63aa7f",
    authority: "https://login.microsoftonline.com/796cb01d-5824-4199-9177-a82623fb5e38", // Usar el tenant especifico
    redirectUri: window.location.origin + "/login",
    postLogoutRedirectUri: window.location.origin + "/login"
  },
  cache: {
    cacheLocation: "sessionStorage", // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
  system: {	
    loggerOptions: {	
      loggerCallback: (level, message, containsPii) => {	
        if (containsPii) {		
          return;		
        }		
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
          default:
            return;
        }	
      }	
    }	
  }
};

export const loginRequest = {
  scopes: ["User.Read", "User.ReadBasic.All"]
};
