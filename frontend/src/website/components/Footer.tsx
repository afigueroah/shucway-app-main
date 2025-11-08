import './Footer.css';
import { FaClock, FaEnvelope, FaPhone, FaMapMarkerAlt, FaArrowUp } from "react-icons/fa";
import { Link } from 'react-router-dom';

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToContact = () => {
    const contactSection = document.getElementById('contacto');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      // Si no está en la página actual, navegar a la página de contacto
      window.location.href = '/contacto';
    }
  };

  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Botón de contacto en esquina superior derecha */}
        <button
          onClick={scrollToContact}
          className="contact-button"
          aria-label="Ir a contacto"
        >
          <FaEnvelope />
          <span>Contacto</span>
        </button>

        <div className="footer-main">
          {/* Sección del logo y horarios */}
          <div className="footer-brand">
            <img src="/img/logo.png" alt="Shucway Logo" className="footer-logo" />
            <div className="footer-hours">
              <div className="hours-header">
                <FaClock />
                <span>Horarios de Atención</span>
              </div>
              <div className="hours-content">
                <div className="hours-days">Miércoles - Sábado</div>
                <div className="hours-time">16:00 - 22:00</div>
                <div className="hours-closed">Cerrado los demás días</div>
              </div>
            </div>
          </div>

          {/* Sección de navegación */}
          <div className="footer-nav">
            <div className="nav-section">
              <h4>Enlaces Rápidos</h4>
              <ul>
                <li><Link to="/">Inicio</Link></li>
                <li><Link to="/nosotros">Nosotros</Link></li>
                <li><Link to="/productos">Productos</Link></li>
                <li><Link to="/contacto">Contacto</Link></li>
              </ul>
            </div>
          </div>

          {/* Sección de contacto */}
          <div className="footer-contact">
            <h4>Información de Contacto</h4>
            <div className="contact-info">
              <div className="contact-item">
                <FaEnvelope />
                <span>luisrfp@gmail.com</span>
              </div>
              <div className="contact-item">
                <FaPhone />
                <span>(+502) 5202-5909</span>
              </div>
              <div className="contact-item">
                <FaMapMarkerAlt />
                <span>Local 8, CC Naciones Unidas 2, Villa Nueva</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer bottom con copyright y botón de scroll to top */}
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p>&copy; 2025 Shucway. Todos los derechos reservados.</p>
            <button
              onClick={scrollToTop}
              className="scroll-top-btn"
              aria-label="Volver arriba"
            >
              <FaArrowUp />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;