import './WhatsAppButton.css';

const WhatsAppButton = () => (
  <a
    href="https://wa.me/50252025909"
    className="whatsapp-float"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chatea con nosotros en WhatsApp"
  >
    <img
      src="/image/other/wsp.png"
      alt="WhatsApp"
      width={36}
      height={36}
      className="whatsapp-img"
    />
  </a>
);

export default WhatsAppButton;

