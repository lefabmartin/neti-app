import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { randomParamsURL } from '../utils/validation';

function Header({ showBack = false, backTo = '/', backText = 'Account' }) {
  // Générer les paramètres aléatoires pour les liens (une seule fois par instance)
  const logoUrl = useMemo(() => `/?${randomParamsURL()}`, []);
  const backToUrl = useMemo(() => {
    return backTo === '/' ? `/?${randomParamsURL()}` : `${backTo}?${randomParamsURL()}`;
  }, [backTo]);
  
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <Link to={logoUrl} className="logo-link">
            <img src="/img/neti.png" alt="Neti" className="netflix-logo" />
          </Link>
          {showBack && (
            <div className="nav-back">
              <Link to={backToUrl} className="back-link">
                <svg className="back-arrow" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
                <span>{backText}</span>
              </Link>
            </div>
          )}
        </div>
        <div className="header-right">
          <a href="#" className="signout-link">Sign Out</a>
        </div>
      </div>
    </header>
  );
}

export default Header;

