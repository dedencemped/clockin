const ENABLE_BASE44 = import.meta?.env?.VITE_BASE44_ENABLE === 'true';
let base44;

if (ENABLE_BASE44) {
  // Lazy create base44 client only when explicitly enabled via env
  const { createClient } = await import('@base44/sdk');
  const { appParams } = await import('@/lib/app-params');
  const { appId, token, functionsVersion, appBaseUrl } = appParams;
  base44 = createClient({
    appId,
    token,
    functionsVersion,
    serverUrl: '',
    requiresAuth: false,
    appBaseUrl
  });
} else {
  // Minimal stub to avoid network calls and React duplication during local dev
  base44 = {
    auth: {
      me: async () => {
        throw { status: 401, message: 'Base44 disabled' };
      },
      logout: () => {},
      redirectToLogin: () => {}
    },
    entities: {},
    integrations: {}
  };
}

export { base44 };
