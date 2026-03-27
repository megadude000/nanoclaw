// Channel self-registration barrel file.
// Each import triggers the channel module's registerChannel() call.

// discord
import './discord.js';

// gmail
import './gmail.js';

// slack

// telegram

// whatsapp (dynamic — @whiskeysockets/baileys may not be installed)
import('./whatsapp.js').catch(() => {
  /* whatsapp skill not installed, skip */
});
