import { chatOverlayFlow } from './chatOverlayFlow';
import { chatOverlayManagerFlow } from './chatOverlayManagerFlow';

// set the flag to display needed flow as example
const isThroughManager = false;

window.onload = () => {
  // checking that overlay doesn't scroll the page
  document.body.style.height = '3000px';

  if (isThroughManager) {
    chatOverlayManagerFlow();
    return;
  }

  chatOverlayFlow();
};
