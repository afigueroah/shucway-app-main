// ...existing code...
import './Contact.css';
import { useEffect } from 'react';

const Contact = () => {
  useEffect(() => {
    const main = document.querySelector('.main-content') as HTMLElement | null;
    if (main) {
      const prev = main.style.flex;
      main.style.flex = '0';
      return () => {
        main.style.flex = prev || '';
      };
    }
    return () => { };
  }, []);
  return (
    <div className="contact-page">
      <div className="contact-main">
        <div className="contact-form-section">
          <h2 className="contact-title">CONTACTANOS</h2>
          <p className="contact-subtitle">Deja tus comentarios, para que podamos atenderte con gusto</p>
          <form className="contact-form-custom" onSubmit={(e) => {
            e.preventDefault();

            const nombre = (e.currentTarget.elements.namedItem("nombre") as HTMLInputElement).value;
            const correo = (e.currentTarget.elements.namedItem("correo") as HTMLInputElement).value;
            const mensaje = (e.currentTarget.elements.namedItem("mensaje") as HTMLInputElement).value;

            const texto = `Hola Shucway %0A
Mi nombre es: ${nombre}%0A
Mi correo es: ${correo}%0A
Mi mensaje es: ${mensaje}%0A`;

            window.open(`https://wa.me/50252025909?text=${texto}`, "_blank");
          }}>
            <input
              type="text"
              name="nombre"
              placeholder="Nombre Completo *"
              required
            />
            <input
              type="email"
              name="correo"
              placeholder="Correo *"
              required
            />
            <textarea
              name="mensaje"
              placeholder="Tu mensaje aquí *"
              rows={4}
              required
              className="contact-textarea"
            ></textarea>
            <button type="submit" className="contact-btn">
              Deja un mensaje <span>&rarr;</span>
            </button>
          </form>

        </div>
        <div className="contact-info-section">
          <div className="contact-info-block">
            <div>
              <span className="contact-label">Correo Electronico</span>
              <p className="contact-value">luisrfp@gmail.com</p>
            </div>
            <div>
              <span className="contact-label">Numero</span>
              <p className="contact-value">(+502) 5202-5909</p>
            </div>
            <div>
              <span className="contact-label">Horario</span>
              <p className="contact-value">Miércoles - Sábado<br />16:00 - 22:00</p>
            </div>
          </div>

          <div className="contact-map">
            <a
              href="https://maps.app.goo.gl/s5bHJLDKRp4qvboB6"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/image/other/location-static-map.png"
                alt="Mapa ubicación Shucway"
                className="contact-map-img"
              />
            </a>
          </div>

        </div>
      </div>

      <div className="contact-whatsapp-section">
        <div className="whatsapp-icon">
          <img src="/image/other/wsp.png" alt="WhatsApp" className="contact-whatsapp-img" />
        </div>
        <span className="whatsapp-text">CONTACTANOS MEDIANTE WHATSAPP</span>
        <a
          href="https://wa.me/50252025909"
          target="_blank"
          rel="noopener noreferrer"
        >
          <button className="whatsapp-btn">INGRESA AQUÍ</button>
        </a>

      </div>


      {/* Footer moved to global Footer component */}
    </div>
  );
};

export default Contact;
