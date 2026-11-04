// Pop-up "Como usar" da tela atual. Carregado só quando alguém abre, para não pesar nas outras telas.
import Modal from "../components/Modal.jsx";
import TutorialPlayer from "./TutorialPlayer.jsx";
import { ROTEIROS } from "./roteiros.jsx";

export default function ComoUsar({ tutorial, titulo, onClose }) {
  return (
    <Modal isOpen title={`Como usar: ${titulo}`} onClose={onClose}>
      {/* key: trocar de tutorial recomeça do primeiro passo. */}
      <TutorialPlayer key={tutorial} passos={ROTEIROS[tutorial]} />
    </Modal>
  );
}
