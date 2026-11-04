// One bundle for both lifts: the checked search (SomaLift) and any answer's model (SomaModel).
import './lift-renderer.mjs';
import './lift-model.mjs';
// The overlay opens for answers as well as for pointing; its "Listening" hint shows only when
// a pointing session gives it text.
document.getElementById('hint')?.style.setProperty('display', 'none');
