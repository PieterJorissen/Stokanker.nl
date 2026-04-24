const WHATSAPP = '+31600000000'; // vervang met echt nummer

const buildings = {
  'romney-loods': {
    name: 'de romneyloods',
    status: 'open',
    voice: 'Anchors and chains. Steel parts with no name you would know. The door at the right end is open. Walk around.',
  },
  'fabriek': {
    name: 'de fabriek',
    status: 'open',
    voice: 'Boilers. Pumps. Stock anchors for Norwegian fish farms, when things are quiet. Ask if you see something.',
  },
  'werkplaats': {
    name: 'de werkplaats',
    status: 'open',
    voice: 'New pumps, parts for old ones. The kantoor is at the east end — knock.',
  },
  'ons-huis': {
    name: 'ons huis',
    status: 'closed',
    voice: null,
  },
  'schuur-complex': {
    name: 'schuur · archief · vriezer',
    status: 'closed',
    voice: null,
  },
  'portal-crane': {
    name: 'American Hoist & Derrick',
    status: 'open',
    voice: 'Marshall Plan. Came over after the war. Worked here for decades. Now in Dordrecht, painted blue. This is how she was.',
  },
  'drijvende-bok': {
    name: 'drijvende bok',
    status: 'away',
    voice: 'Not here right now. When she is, the cook makes curry.',
  },
  'boomgaard': {
    name: 'de boomgaard',
    status: 'open',
    voice: 'Pears. Walnut. Later a plum. The apentreiter in the corner — don\'t touch the leaves. Chickens used to make nests in here. Eggs rotted before anyone found them.',
  },
  'smalspoor-cart': {
    name: 'de kar',
    status: 'open',
    voice: 'This is what\'s on the cart right now. Before lorries and big cranes, everything heavy moved on these tracks. If you see something, ask.',
  },
};

function openDialogue(id) {
  const b = buildings[id];
  if (!b) return;

  const overlay = document.getElementById('dialogue-overlay');
  const title   = document.getElementById('dialogue-title');
  const status  = document.getElementById('dialogue-status');
  const bubble  = document.getElementById('dialogue-bubble');
  const input   = document.getElementById('dialogue-input');
  const sendBtn = document.getElementById('dialogue-send');
  const inputRow = document.getElementById('dialogue-input-row');

  title.textContent  = b.name;
  status.textContent = b.status;
  status.className   = 'dialogue-status ' + b.status;

  if (b.status === 'closed') {
    bubble.textContent = 'Dicht.';
    inputRow.style.display = 'none';
  } else if (b.status === 'away') {
    bubble.textContent = b.voice || '';
    inputRow.style.display = 'none';
  } else {
    bubble.textContent = b.voice || '';
    inputRow.style.display = 'flex';
    input.value = '';
  }

  sendBtn.onclick = () => {
    const msg = input.value.trim();
    const text = encodeURIComponent(
      (b.name ? '[' + b.name + '] ' : '') + (msg || 'Hallo')
    );
    window.open('https://wa.me/' + WHATSAPP.replace(/\D/g, '') + '?text=' + text, '_blank');
  };

  overlay.classList.add('visible');
  if (b.status === 'open') input.focus();
}

function closeDialogue() {
  document.getElementById('dialogue-overlay').classList.remove('visible');
}

document.addEventListener('DOMContentLoaded', () => {
  Object.keys(buildings).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => openDialogue(id));
    }
  });

  document.getElementById('dialogue-close').addEventListener('click', closeDialogue);
  document.getElementById('dialogue-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDialogue();
  });

  document.getElementById('dialogue-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('dialogue-send').click();
    }
  });
});
