// Wrapper pour adapter globalWebSocket au format attendu par Dashboard
// Ce wrapper expose window.wsClient avec une interface compatible

let wsClientWrapper = null;
let eventListeners = new Map(); // Map<eventName, Set<callbacks>>
let ws = null; // WebSocket instance globale

// Fonction pour obtenir ou créer le wrapper
function getWsClientWrapper() {
  if (wsClientWrapper) {
    return wsClientWrapper;
  }

  // Importer globalWebSocket depuis useWebSocket
  // Note: On doit accéder à globalWebSocket via le module useWebSocket
  // Pour cela, on va créer une connexion WebSocket dédiée pour le dashboard
  
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
  let isConnected = false;
  let clientId = null;

  // Créer une connexion WebSocket dédiée pour le dashboard
  const connect = (url) => {
    // Réutiliser la connexion existante si elle est ouverte
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('[wsClientWrapper] Already connected, reusing existing connection');
      return;
    }

    // Attendre si la connexion est en cours
    if (ws && ws.readyState === WebSocket.CONNECTING) {
      console.log('[wsClientWrapper] Connection already in progress, waiting...');
      return;
    }

    // Fermer l'ancienne connexion si elle existe et est fermée
    if (ws && ws.readyState === WebSocket.CLOSED) {
      console.log('[wsClientWrapper] Old connection closed, creating new one');
      ws = null;
    }

    console.log('[wsClientWrapper] Connecting to:', url);
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[wsClientWrapper] WebSocket connected');
      isConnected = true;
      emit('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[wsClientWrapper] Message received:', data.type, data);
        
        // Émettre les événements spécifiques
        if (data.type === 'welcome') {
          clientId = data.clientId;
          emit('connected');
        } else if (data.type === 'registered') {
          clientId = data.clientId;
          emit('registered', data);
        } else if (data.type === 'clients') {
          emit('clients', data);
        } else if (data.type === 'client_registered') {
          emit('client_registered', data);
        } else if (data.type === 'client_updated') {
          emit('client_updated', data);
        } else if (data.type === 'client_disconnected') {
          emit('client_disconnected', data);
        }
        
        // Émettre un événement générique 'message'
        emit('message', data);
      } catch (error) {
        console.error('[wsClientWrapper] Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[wsClientWrapper] WebSocket error:', error);
      isConnected = false;
      emit('error', error);
    };

    ws.onclose = () => {
      console.log('[wsClientWrapper] WebSocket closed');
      isConnected = false;
      emit('close');
    };
  };

  const emit = (eventName, ...args) => {
    const listeners = eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[wsClientWrapper] Error in ${eventName} listener:`, error);
        }
      });
    }
  };

  wsClientWrapper = {
    connect(url) {
      connect(url || wsUrl);
    },
    
    register(role) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const message = {
          type: 'register',
          role: role,
          page: window.location.pathname
        };
        console.log('[wsClientWrapper] Registering as:', role);
        ws.send(JSON.stringify(message));
      } else {
        console.warn('[wsClientWrapper] Cannot register - WebSocket not open');
      }
    },
    
    send(message) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        console.log('[wsClientWrapper] 📤 Sending message:', messageStr);
        console.log('[wsClientWrapper] 📤 WebSocket readyState:', ws.readyState);
        ws.send(messageStr);
        console.log('[wsClientWrapper] ✅ Message sent successfully');
        return true;
      } else {
        console.warn('[wsClientWrapper] Cannot send - WebSocket not open, readyState:', ws?.readyState);
        return false;
      }
    },
    
    on(eventName, callback) {
      if (!eventListeners.has(eventName)) {
        eventListeners.set(eventName, new Set());
      }
      eventListeners.get(eventName).add(callback);
    },
    
    off(eventName, callback) {
      const listeners = eventListeners.get(eventName);
      if (listeners) {
        listeners.delete(callback);
      }
    }
  };

  // Mettre à jour isConnected via un getter
  Object.defineProperty(wsClientWrapper, 'isConnected', {
    get() {
      return ws && ws.readyState === WebSocket.OPEN;
    },
    configurable: true
  });

  return wsClientWrapper;
}

// Exposer sur window pour que Dashboard puisse l'utiliser
if (typeof window !== 'undefined') {
  // Initialiser le wrapper
  window.wsClient = getWsClientWrapper();
  
  // Connecter automatiquement si pas déjà connecté
  if (!window.wsClient.isConnected) {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
    window.wsClient.connect(wsUrl);
  }
}

export default getWsClientWrapper;

