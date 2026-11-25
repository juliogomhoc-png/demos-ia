/*!
 * Asistente para restaurantes — widget embebible (versión de producción)
 * Hecho por Julio · Granada
 *
 * Uso en la web del cliente (una línea antes de </body>):
 *   <script src="https://juliogomhoc-png.github.io/demos-ia/asistente/asistente.js"
 *           data-config="https://juliogomhoc-png.github.io/demos-ia/asistente/negocios/casa-gabriel.json"
 *           defer></script>
 *
 * También vale para un QR de mesa o un enlace en Google: pagina.html?n=casa-gabriel
 * Sin cookies. Las reservas se mandan al endpoint de Apps Script del config.
 */
(function () {
  'use strict';

  var me = document.currentScript;
  var cfgUrl = me && me.getAttribute('data-config');
  var paginaCompleta = me && me.hasAttribute('data-pagina');

  function cargar() {
    if (window.ASISTENTE_CONFIG) return Promise.resolve(window.ASISTENTE_CONFIG);
    if (!cfgUrl) {
      var n = new URLSearchParams(location.search).get('n');
      if (n && /^[a-z0-9-]+$/.test(n)) cfgUrl = 'negocios/' + n + '.json';
    }
    if (!cfgUrl) return Promise.reject(new Error('Asistente: falta data-config'));
    return fetch(cfgUrl, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Asistente: no se pudo leer ' + cfgUrl);
      return r.json();
    });
  }

  /* ---------------- utilidades ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lista(a, y) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' ' + y + ' ' + a[a.length - 1]; }
  function sinTildes(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function pad(n) { return String(n).padStart(2, '0'); }

  var DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  var DIAS_TXT = {
    es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  };

  function detectarIdioma(s) {
    var x = ' ' + s.toLowerCase() + ' ';
    var en = (x.match(/\b(hi|hello|hey|table|book|booking|where|open|opening|what|can|for|people|tonight|vegan|vegetarian|menu|thanks|thank|recommend|hours|please|price|parking)\b/g) || []).length;
    var fr = (x.match(/(bonjour|salut|réserv|reserver|où|ouvert|une table|pour|personnes|ce soir|végé|vege|carte|merci|horaires|recommandez|adresse|s'il vous)/g) || []).length;
    var es = (x.match(/(hola|reserv|mesa|dónde|donde|abr|cierr|hora|personas|vegetarian|recomend|gracias|carta|qué|que |precio|aparcar)/g) || []).length;
    if (en > es && en >= fr && en > 0) return 'en';
    if (fr > es && fr > en && fr > 0) return 'fr';
    if (es > 0) return 'es';
    return null;
  }

  function numero(s) {
    var m = s.match(/\d+/); if (m) return +m[0];
    var w = { un: 1, uno: 1, una: 1, one: 1, dos: 2, two: 2, deux: 2, tres: 3, three: 3, trois: 3, cuatro: 4, four: 4, quatre: 4, cinco: 5, five: 5, cinq: 5, seis: 6, six: 6, siete: 7, seven: 7, sept: 7, ocho: 8, eight: 8, huit: 8, nueve: 9, nine: 9, neuf: 9, diez: 10, ten: 10, dix: 10 };
    var p = s.toLowerCase().split(/\W+/);
    for (var i = 0; i < p.length; i++) if (w[p[i]]) return w[p[i]];
    return 0;
  }

  function leerHora(s) {
    var m = s.toLowerCase().match(/(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?\s*(pm|p\.m\.|am|a\.m\.|de la noche|de la tarde|du soir)?/);
    if (!m) return null;
    var h = +m[1], mi = m[2] || '00';
    if (m[3] && !/^a/.test(m[3]) && h < 12) h += 12;
    if (!m[3] && h >= 1 && h <= 11 && h !== 10 && h !== 11) h += 12; // "a las 9" en un restaurante = 21:00
    if (h > 23 || +mi > 59) return null;
    return pad(h) + ':' + mi;
  }

  /* Convierte "hoy", "mañana", "viernes", "12/12" o "12 de diciembre" en una fecha */
  function leerFecha(s) {
    var x = sinTildes(s.toLowerCase());
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (/\b(hoy|today|aujourd)/.test(x)) return hoy;
    if (/pasado manana|day after tomorrow|apres-demain|apres demain/.test(x)) return new Date(hoy.getTime() + 2 * 864e5);
    if (/\b(manana|tomorrow|demain)\b/.test(x)) return new Date(hoy.getTime() + 864e5);
    var nombres = [['domingo', 'sunday', 'dimanche'], ['lunes', 'monday', 'lundi'], ['martes', 'tuesday', 'mardi'], ['miercoles', 'wednesday', 'mercredi'], ['jueves', 'thursday', 'jeudi'], ['viernes', 'friday', 'vendredi'], ['sabado', 'saturday', 'samedi']];
    for (var d = 0; d < 7; d++) {
      for (var k = 0; k < 3; k++) {
        if (x.indexOf(nombres[d][k]) >= 0) {
          var dif = (d - hoy.getDay() + 7) % 7;
          return new Date(hoy.getTime() + dif * 864e5);
        }
      }
    }
    var m = x.match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/);
    var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var mesesEn = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    var mesesFr = ['janv', 'fevr', 'mars', 'avril', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'dec'];
    var dia = null, mes = null;
    if (m) { dia = +m[1]; mes = +m[2] - 1; }
    else {
      var md = x.match(/(\d{1,2})/);
      if (md) {
        for (var i = 0; i < 12; i++) {
          if (x.indexOf(meses[i]) >= 0 || x.indexOf(mesesEn[i]) >= 0 || x.indexOf(mesesFr[i]) >= 0) { dia = +md[1]; mes = i; break; }
        }
      }
    }
    if (dia !== null && mes !== null && dia >= 1 && dia <= 31 && mes >= 0 && mes < 12) {
      var f = new Date(hoy.getFullYear(), mes, dia);
      if (f < hoy) f.setFullYear(f.getFullYear() + 1);
      return f;
    }
    return null;
  }

  function fechaISO(f) { return f.getFullYear() + '-' + pad(f.getMonth() + 1) + '-' + pad(f.getDate()); }
  function fechaTexto(f, L) {
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var dif = Math.round((f - hoy) / 864e5);
    var rel = { es: ['hoy', 'mañana'], en: ['today', 'tomorrow'], fr: ["aujourd'hui", 'demain'] }[L];
    if (dif === 0) return rel[0];
    if (dif === 1) return rel[1];
    var dd = DIAS_TXT[L][f.getDay()] + ' ' + f.getDate() + '/' + (f.getMonth() + 1);
    return dd;
  }

  /* horario: { "lunes": "cerrado", "martes": "13:00-16:00, 20:00-23:30", ... } */
  function franjasDe(C, f) {
    var h = (C.horario || {})[DIAS[f.getDay()]];
    if (!h || /cerrad|closed/i.test(h)) return [];
    return h.split(',').map(function (t) {
      var p = t.trim().split('-');
      return { de: p[0].trim(), a: (p[1] || '').trim() };
    });
  }
  function minutos(h) { var p = h.split(':'); return +p[0] * 60 + (+p[1] || 0); }
  function horaDentro(C, f, h) {
    var fr = franjasDe(C, f);
    var m = minutos(h);
    for (var i = 0; i < fr.length; i++) {
      var de = minutos(fr[i].de), a = minutos(fr[i].a);
      if (a < de) a += 24 * 60;
      // admite reservas hasta 45 min antes del cierre de cocina
      if (m >= de && m <= a - 45) return true;
    }
    return false;
  }
  function horasSugeridas(C, f) {
    var out = [];
    franjasDe(C, f).forEach(function (fr) {
      var de = minutos(fr.de), a = minutos(fr.a); if (a < de) a += 1440;
      for (var m = de + 30; m <= a - 60 && out.length < 6; m += 60) out.push(pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60));
    });
    return out.slice(0, 4);
  }

  /* ---------------- textos ---------------- */
  function textos(C) {
    var n = C.nombre;
    var platos = (C.platos || []).map(function (p) { return p.nombre || p; });
    var veg = (C.platos || []).filter(function (p) { return p.vegetariano; }).map(function (p) { return p.nombre; });
    var tel = C.telefono;
    return {
      es: {
        sub: 'Asistente · responde al momento', ph: 'Escribe tu mensaje…', abrir: 'Reservar / preguntar',
        chips: ['Reservar mesa', '¿Qué horario tenéis?', '¿Dónde estáis?', '¿Qué me recomendáis?', 'Opciones vegetarianas'],
        hola: '¡Hola! Soy el asistente de ' + n + '. Te puedo reservar mesa, decirte el horario, cómo llegar o qué recomendamos. ¿Qué necesitas?',
        hor: function (t) { return 'Nuestro horario: ' + t + '. ¿Te reservo mesa?'; },
        don: 'Estamos en ' + C.direccion + '.', mapa: 'Abrir en Google Maps',
        pla: platos.length ? 'Lo que más se pide: ' + lista(platos, 'y') + '. ¿Te reservo mesa?' : 'Te lo cuenta el equipo encantado. ¿Te reservo mesa?',
        veg: veg.length ? 'Opciones vegetarianas: ' + lista(veg, 'y') + '. Si tienes alguna alergia, avisa al llegar y el equipo te lo confirma.' : 'Pregunta al equipo por las opciones vegetarianas del día. Si tienes alguna alergia, avisa al llegar y te lo confirman.',
        nose: tel ? 'Eso prefiero que te lo confirme el equipo: llama al ' + tel + '. Yo te ayudo con reservas, horario, cómo llegar o qué pedir.' : 'Eso te lo confirma el equipo en el local. Yo te ayudo con reservas, horario, cómo llegar o qué pedir.',
        r1: '¡Genial! ¿Para cuántas personas?', r1e: '¿Cuántas personas seréis? Dime un número, por ejemplo 2.',
        rGrupo: function (max) { return 'Para grupos de más de ' + max + ' personas lo gestiona el equipo directamente' + (tel ? ': llama al ' + tel : '') + '. ¡Gracias!'; },
        r2: '¿Qué día queréis venir?', r2c: ['Hoy', 'Mañana', 'Viernes', 'Sábado'], r2e: 'No he entendido el día. Prueba con "mañana", "sábado" o "12/12".',
        r2cerr: function (d) { return 'El ' + d + ' estamos cerrados. ¿Otro día?'; },
        r3: '¿A qué hora?', r3e: 'Dime la hora, por ejemplo 21:00.',
        r3fuera: function (t) { return 'A esa hora no tenemos cocina abierta. Ese día el horario es ' + t + '. ¿Otra hora?'; },
        r4: '¿A nombre de quién la pongo?',
        r5: 'Por último, ¿un teléfono o email para confirmarte la reserva?', r5e: 'Necesito un teléfono o un email válido para que el restaurante pueda confirmarte.',
        rNota: '¿Algo que debamos saber? (alergias, trona, terraza…) Si no, escribe "no".',
        resumen: function (r) { return 'Resumen: ' + r.personas + ' personas, ' + r.diaTxt + ' a las ' + r.hora + ', a nombre de ' + r.nombre + '. ¿Lo confirmo?'; },
        si: 'Sí, confirmar', no: 'Cambiar algo',
        enviando: 'Enviando la solicitud…',
        ok: function (r) { return '¡Hecho, ' + r.nombre + '! Hemos recibido tu solicitud: mesa para ' + r.personas + ', ' + r.diaTxt + ' a las ' + r.hora + '. El restaurante te la confirmará en ' + r.contacto + '.'; },
        err: 'Vaya, no he podido enviar la reserva.' + (tel ? ' Llama al ' + tel + ' y te la cogen al momento.' : ' Inténtalo de nuevo en un momento.'),
        cancel: 'Sin problema, empezamos de nuevo. ¿Para cuántas personas?',
        gracias: '¡A ti! Aquí estoy para lo que necesites.',
        priv: 'Tus datos solo se usan para gestionar esta reserva con ' + n + '.'
      },
      en: {
        sub: 'Assistant · instant replies', ph: 'Type your message…', abrir: 'Book / ask',
        chips: ['Book a table', 'Opening hours', 'Where are you?', 'What do you recommend?', 'Vegetarian options'],
        hola: "Hi! I'm " + n + "'s assistant. I can book you a table, tell you our hours, how to get here or what we recommend. How can I help?",
        hor: function (t) { return 'Our opening hours: ' + t + '. Shall I book you a table?'; },
        don: "We're at " + C.direccion + '.', mapa: 'Open in Google Maps',
        pla: platos.length ? "Guests' favourites: " + lista(platos, 'and') + '. Shall I book you a table?' : 'The team will happily tell you. Shall I book you a table?',
        veg: veg.length ? 'Vegetarian options: ' + lista(veg, 'and') + '. If you have an allergy, tell the team when you arrive and they will double-check.' : 'Ask the team about today\'s vegetarian options. If you have an allergy, tell them when you arrive.',
        nose: tel ? 'The team can confirm that for you: call ' + tel + '. I can help with bookings, hours, directions or what to order.' : 'The team will confirm that at the restaurant. I can help with bookings, hours, directions or what to order.',
        r1: 'Great! For how many people?', r1e: 'How many of you? Just send a number, e.g. 2.',
        rGrupo: function (max) { return 'For groups of more than ' + max + ' the team handles it directly' + (tel ? ': call ' + tel : '') + '. Thank you!'; },
        r2: 'Which day would you like to come?', r2c: ['Today', 'Tomorrow', 'Friday', 'Saturday'], r2e: 'Sorry, I didn\'t get the day. Try "tomorrow", "Saturday" or "12/12".',
        r2cerr: function (d) { return "We're closed on " + d + '. Another day?'; },
        r3: 'What time?', r3e: 'Tell me the time, e.g. 9pm.',
        r3fuera: function (t) { return "The kitchen isn't open at that time. That day we're open " + t + '. Another time?'; },
        r4: 'What name should I put it under?',
        r5: 'Lastly, a phone number or email so the restaurant can confirm?', r5e: 'I need a valid phone number or email so the restaurant can confirm.',
        rNota: 'Anything we should know? (allergies, high chair, terrace…) If not, type "no".',
        resumen: function (r) { return 'Summary: ' + r.personas + ' people, ' + r.diaTxt + ' at ' + r.hora + ', under ' + r.nombre + '. Shall I confirm?'; },
        si: 'Yes, confirm', no: 'Change something',
        enviando: 'Sending your request…',
        ok: function (r) { return 'Done, ' + r.nombre + '! We\'ve received your request: table for ' + r.personas + ', ' + r.diaTxt + ' at ' + r.hora + '. The restaurant will confirm via ' + r.contacto + '.'; },
        err: "Sorry, I couldn't send the booking." + (tel ? ' Call ' + tel + ' and they\'ll book it straight away.' : ' Please try again in a moment.'),
        cancel: 'No problem, let\'s start again. For how many people?',
        gracias: "You're welcome! I'm here if you need anything else.",
        priv: 'Your details are only used to manage this booking with ' + n + '.'
      },
      fr: {
        sub: 'Assistant · réponse immédiate', ph: 'Écrivez votre message…', abrir: 'Réserver / demander',
        chips: ['Réserver une table', 'Horaires', 'Où êtes-vous ?', 'Que recommandez-vous ?', 'Options végétariennes'],
        hola: "Bonjour ! Je suis l'assistant de " + n + '. Je peux vous réserver une table, vous donner nos horaires, l\'adresse ou nos recommandations. Que puis-je faire pour vous ?',
        hor: function (t) { return 'Nos horaires : ' + t + '. Je vous réserve une table ?'; },
        don: 'Nous sommes au ' + C.direccion + '.', mapa: 'Ouvrir dans Google Maps',
        pla: platos.length ? 'Les préférés de nos clients : ' + lista(platos, 'et') + '. Je vous réserve une table ?' : "L'équipe vous conseillera avec plaisir. Je vous réserve une table ?",
        veg: veg.length ? 'Options végétariennes : ' + lista(veg, 'et') + ". En cas d'allergie, prévenez l'équipe à votre arrivée." : "Demandez à l'équipe les options végétariennes du jour. En cas d'allergie, prévenez-la à votre arrivée.",
        nose: tel ? "L'équipe pourra vous le confirmer : appelez le " + tel + '. Je peux vous aider pour réserver, les horaires, l\'adresse ou quoi commander.' : "L'équipe vous le confirmera sur place. Je peux vous aider pour réserver, les horaires, l'adresse ou quoi commander.",
        r1: 'Parfait ! Pour combien de personnes ?', r1e: 'Combien serez-vous ? Envoyez un chiffre, par ex. 2.',
        rGrupo: function (max) { return 'Pour les groupes de plus de ' + max + " personnes, l'équipe s'en occupe directement" + (tel ? ' : appelez le ' + tel : '') + '. Merci !'; },
        r2: 'Quel jour souhaitez-vous venir ?', r2c: ["Aujourd'hui", 'Demain', 'Vendredi', 'Samedi'], r2e: 'Je n\'ai pas compris le jour. Essayez « demain », « samedi » ou « 12/12 ».',
        r2cerr: function (d) { return 'Nous sommes fermés le ' + d + '. Un autre jour ?'; },
        r3: 'À quelle heure ?', r3e: "Indiquez l'heure, par ex. 21h00.",
        r3fuera: function (t) { return "La cuisine n'est pas ouverte à cette heure. Ce jour-là nous sommes ouverts " + t + '. Une autre heure ?'; },
        r4: 'À quel nom dois-je réserver ?',
        r5: 'Enfin, un téléphone ou un e-mail pour vous confirmer ?', r5e: 'Il me faut un téléphone ou un e-mail valide pour que le restaurant vous confirme.',
        rNota: 'Quelque chose à signaler ? (allergies, chaise haute, terrasse…) Sinon, écrivez « non ».',
        resumen: function (r) { return 'Récapitulatif : ' + r.personas + ' personnes, ' + r.diaTxt + ' à ' + r.hora + ', au nom de ' + r.nombre + '. Je confirme ?'; },
        si: 'Oui, confirmer', no: 'Modifier',
        enviando: 'Envoi de la demande…',
        ok: function (r) { return "C'est noté, " + r.nombre + ' ! Demande reçue : table pour ' + r.personas + ', ' + r.diaTxt + ' à ' + r.hora + '. Le restaurant vous confirmera par ' + r.contacto + '.'; },
        err: "Désolé, je n'ai pas pu envoyer la réservation." + (tel ? ' Appelez le ' + tel + ', ils la prendront tout de suite.' : ' Réessayez dans un instant.'),
        cancel: 'Pas de souci, on recommence. Pour combien de personnes ?',
        gracias: 'Avec plaisir ! Je reste à votre disposition.',
        priv: 'Vos données servent uniquement à gérer cette réservation avec ' + n + '.'
      }
    };
  }

  function horarioTexto(C, L) {
    var h = C.horario || {};
    var partes = [];
    for (var i = 1; i <= 7; i++) {
      var d = i % 7;
      var v = h[DIAS[d]];
      if (!v) continue;
      var cerr = /cerrad|closed/i.test(v);
      partes.push(DIAS_TXT[L][d] + ' ' + (cerr ? ({ es: 'cerrado', en: 'closed', fr: 'fermé' })[L] : v.replace(/\s*-\s*/g, '–')));
    }
    return partes.join('; ');
  }

  /* ---------------- estilos ---------------- */
  function css(color) {
    return '' +
      '.asis-root{--c:' + color + ';font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1c1917}' +
      '.asis-root *{box-sizing:border-box}' +
      '.asis-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;background:var(--c);color:#fff;border:0;border-radius:999px;padding:13px 18px;font:600 15px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer;display:flex;gap:8px;align-items:center}' +
      '.asis-btn svg{width:20px;height:20px}' +
      '.asis-win{position:fixed;right:18px;bottom:84px;z-index:2147483001;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 110px));background:#fff;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden}' +
      '.asis-win.on{display:flex}' +
      '.asis-root.pagina .asis-btn{display:none}' +
      '.asis-root.pagina .asis-win{display:flex;position:static;width:100%;max-width:520px;height:calc(100vh - 32px);margin:16px auto;box-shadow:0 10px 40px rgba(0,0,0,.12)}' +
      '.asis-hd{background:var(--c);color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px}' +
      '.asis-av{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.22);display:grid;place-items:center;font-weight:700}' +
      '.asis-hd b{display:block;font-size:15px}.asis-hd small{opacity:.85;font-size:12px}' +
      '.asis-langs{margin-left:auto;display:flex;gap:4px}' +
      '.asis-langs button{background:rgba(255,255,255,.18);color:#fff;border:0;border-radius:6px;padding:3px 6px;font:600 11px system-ui;cursor:pointer}' +
      '.asis-langs button.on{background:#fff;color:var(--c)}' +
      '.asis-x{background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 2px}' +
      '.asis-root.pagina .asis-x{display:none}' +
      '.asis-msgs{flex:1;overflow-y:auto;padding:14px;background:#faf8f6;display:flex;flex-direction:column;gap:8px}' +
      '.asis-m{max-width:84%;padding:9px 12px;border-radius:14px;white-space:pre-line;word-wrap:break-word}' +
      '.asis-m.bot{background:#fff;border:1px solid #eee7e1;align-self:flex-start;border-bottom-left-radius:4px}' +
      '.asis-m.me{background:var(--c);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
      '.asis-m a{color:var(--c);font-weight:600}' +
      '.asis-typing{align-self:flex-start;background:#fff;border:1px solid #eee7e1;border-radius:14px;padding:10px 12px;display:flex;gap:4px}' +
      '.asis-typing i{width:6px;height:6px;border-radius:50%;background:#bbb;animation:asisB 1s infinite}' +
      '.asis-typing i:nth-child(2){animation-delay:.15s}.asis-typing i:nth-child(3){animation-delay:.3s}' +
      '@keyframes asisB{0%,60%,100%{opacity:.3}30%{opacity:1}}' +
      '.asis-chips{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px 0;background:#fff}' +
      '.asis-chips button{border:1px solid var(--c);color:var(--c);background:#fff;border-radius:999px;padding:5px 10px;font:500 13px system-ui;cursor:pointer}' +
      '.asis-f{display:flex;gap:8px;padding:10px 12px 12px;background:#fff;border-top:1px solid #f1ece7}' +
      '.asis-f input{flex:1;border:1px solid #ddd5ce;border-radius:999px;padding:10px 14px;font:15px system-ui;outline:none;min-width:0}' +
      '.asis-f input:focus{border-color:var(--c)}' +
      '.asis-f button{background:var(--c);color:#fff;border:0;border-radius:999px;width:42px;cursor:pointer;font-size:18px}' +
      '.asis-priv{font-size:11px;color:#8a7f76;text-align:center;padding:0 12px 8px;background:#fff}' +
      '@media (prefers-reduced-motion:reduce){.asis-typing i{animation:none}}';
  }

  /* ---------------- widget ---------------- */
  function montar(C) {
    var T = textos(C);
    var L = (C.idioma && T[C.idioma]) ? C.idioma : 'es';
    var nav = (navigator.language || '').slice(0, 2);
    if (T[nav]) L = nav;
    var flow = null;
    var maxGrupo = C.max_personas || 10;

    var st = document.createElement('style'); st.textContent = css(C.color || '#b45309'); document.head.appendChild(st);
    var root = document.createElement('div');
    root.className = 'asis-root' + (paginaCompleta ? ' pagina' : '');
    root.innerHTML =
      '<button class="asis-btn" type="button" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span></span></button>' +
      '<div class="asis-win" role="dialog" aria-label="Asistente de ' + esc(C.nombre) + '">' +
      '<div class="asis-hd"><div class="asis-av">' + esc(C.nombre.replace(/^(El|La|Los|Las|Restaurante|Bar)\s+/i, '').charAt(0)) + '</div>' +
      '<div><b>' + esc(C.nombre) + '</b><small class="asis-sub"></small></div>' +
      '<div class="asis-langs"></div><button class="asis-x" type="button" aria-label="Cerrar">×</button></div>' +
      '<div class="asis-msgs" aria-live="polite"></div>' +
      '<div class="asis-chips"></div>' +
      '<form class="asis-f"><input autocomplete="off" maxlength="300"><button type="submit" aria-label="Enviar">➤</button></form>' +
      '<div class="asis-priv"></div></div>';
    document.body.appendChild(root);

    var q = function (s) { return root.querySelector(s); };
    var btn = q('.asis-btn'), win = q('.asis-win'), msgs = q('.asis-msgs'), chipsEl = q('.asis-chips'), input = q('input');
    var saludado = false;

    function abrir(v) {
      win.classList.toggle('on', v); btn.setAttribute('aria-expanded', v);
      if (v) { if (!saludado) { saludado = true; bot(T[L].hola); } setTimeout(function () { input.focus(); }, 50); }
    }
    btn.onclick = function () { abrir(!win.classList.contains('on')); };
    q('.asis-x').onclick = function () { abrir(false); };
    if (paginaCompleta) { saludado = true; setTimeout(function () { bot(T[L].hola); }, 200); }

    ['es', 'en', 'fr'].forEach(function (l) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = l.toUpperCase(); b.dataset.l = l;
      b.onclick = function () { setLang(l); if (!flow) bot(T[l].hola); };
      q('.asis-langs').appendChild(b);
    });

    function setLang(l) {
      L = l;
      root.querySelectorAll('.asis-langs button').forEach(function (b) { b.classList.toggle('on', b.dataset.l === l); });
      q('.asis-sub').textContent = T[l].sub; input.placeholder = T[l].ph;
      q('.asis-btn span').textContent = T[l].abrir; q('.asis-priv').textContent = T[l].priv;
      if (!flow) chips(T[l].chips);
    }

    function add(html, who) { var d = document.createElement('div'); d.className = 'asis-m ' + who; d.innerHTML = html; msgs.appendChild(d); msgs.scrollTop = 1e9; }
    function bot(text, extra) {
      var t = document.createElement('div'); t.className = 'asis-typing'; t.innerHTML = '<i></i><i></i><i></i>'; msgs.appendChild(t); msgs.scrollTop = 1e9;
      return new Promise(function (res) { setTimeout(function () { t.remove(); add(esc(text) + (extra || ''), 'bot'); res(); }, 400 + Math.min(text.length * 6, 700)); });
    }
    function chips(arr) {
      chipsEl.innerHTML = '';
      arr.forEach(function (c) { var b = document.createElement('button'); b.type = 'button'; b.textContent = c; b.onclick = function () { send(c); }; chipsEl.appendChild(b); });
    }

    function faqPropia(s) {
      var lst = C.faq || [];
      for (var i = 0; i < lst.length; i++) {
        var f = lst[i];
        var ok = (f.claves || []).some(function (k) { return sinTildes(s).indexOf(sinTildes(k.toLowerCase())) >= 0; });
        if (ok) return f.respuesta[L] || f.respuesta.es;
      }
      return null;
    }

    function enviarReserva(r) {
      var datos = {
        negocio: C.slug, token: C.token || '', nombre: r.nombre, personas: r.personas, fecha: r.fecha, hora: r.hora,
        contacto: r.contacto, notas: r.notas || '', idioma: L, origen: location.href.slice(0, 200)
      };
      if (!C.endpoint) return Promise.reject(new Error('sin endpoint'));
      // text/plain evita la petición previa CORS que Apps Script no admite
      return fetch(C.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos) })
        .then(function (res) { return res.json(); })
        .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || 'error'); return j; });
    }

    function send(text) {
      text = String(text).trim(); if (!text) return;
      add(esc(text), 'me'); input.value = '';
      if (!flow) { var d = detectarIdioma(text); if (d && d !== L) setLang(d); }
      var t = T[L], s = text.toLowerCase();

      if (flow) {
        if (/^(cancelar|cancel|annuler|empezar de nuevo|start over)$/.test(s)) { flow = { step: 1 }; chips(['2', '3', '4', '6']); return bot(t.cancel); }
        // Una pregunta en mitad de la reserva: se contesta y se retoma el paso en el que estaba
        if (/\?/.test(text) && !/reserv|book|réserv/.test(s)) {
          var pregunta = { 1: t.r1, 2: t.r2, 3: t.r3, 4: t.r4, 5: t.r5, 6: t.rNota, 7: t.resumen(flow) }[flow.step];
          return responder(s, t).then(function () { return bot(pregunta); });
        }
        if (flow.step === 1) {
          var n = numero(s); if (!n) return bot(t.r1e);
          if (n > maxGrupo) { flow = null; chips(t.chips); return bot(t.rGrupo(maxGrupo)); }
          flow.personas = n; flow.step = 2; chips(t.r2c); return bot(t.r2);
        }
        if (flow.step === 2) {
          var f = leerFecha(text); if (!f) return bot(t.r2e);
          if (C.horario && !franjasDe(C, f).length) { return bot(t.r2cerr(fechaTexto(f, L))); }
          flow.f = f; flow.fecha = fechaISO(f); flow.diaTxt = fechaTexto(f, L); flow.step = 3;
          chips(horasSugeridas(C, f)); return bot(t.r3);
        }
        if (flow.step === 3) {
          var h = leerHora(text); if (!h) return bot(t.r3e);
          if (C.horario && !horaDentro(C, flow.f, h)) {
            var txt = franjasDe(C, flow.f).map(function (x) { return x.de + '–' + x.a; }).join(', ');
            chips(horasSugeridas(C, flow.f)); return bot(t.r3fuera(txt));
          }
          flow.hora = h; flow.step = 4; chips([]); return bot(t.r4);
        }
        if (flow.step === 4) {
          flow.nombre = text.replace(/^(soy|me llamo|a nombre de|my name is|i'm|i am|je suis|au nom de)\s+/i, '').split(/\s+/).slice(0, 3).join(' ').slice(0, 60);
          flow.step = 5; return bot(t.r5);
        }
        if (flow.step === 5) {
          var tel = text.replace(/[\s.\-()]/g, '');
          var esTel = /^\+?\d{9,15}$/.test(tel), esMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text);
          if (!esTel && !esMail) return bot(t.r5e);
          flow.contacto = esTel ? tel : text; flow.step = 6; chips([({ es: 'No', en: 'No', fr: 'Non' })[L]]); return bot(t.rNota);
        }
        if (flow.step === 6) {
          flow.notas = /^(no|non|nada|nothing|rien|ninguna|none)\.?$/i.test(s) ? '' : text.slice(0, 300);
          flow.step = 7; chips([t.si, t.no]); return bot(t.resumen(flow));
        }
        if (flow.step === 7) {
          if (text === t.no || /^(no|non|cambiar|change|modifier)/i.test(s)) { flow = { step: 1 }; chips(['2', '3', '4', '6']); return bot(t.cancel); }
          var r = flow; flow = null; chips([]);
          return bot(t.enviando).then(function () {
            return enviarReserva(r).then(function () { chips(t.chips); return bot(t.ok(r)); }, function () { chips(t.chips); return bot(t.err); });
          });
        }
      }

      if (/reserv|mesa|book|table|réserv/.test(s) && !faqPropia(s)) { flow = { step: 1 }; chips(['2', '3', '4', '6']); return bot(t.r1); }
      return responder(s, t);
    }

    function responder(s, t) {
      var propia = faqPropia(s);
      if (propia) return bot(propia);
      if (/hora|horario|abr|cierr|open|close|hours|heure|horaire|ouvert|ferm/.test(s)) {
        var ht = horarioTexto(C, L); return bot(ht ? t.hor(ht) : t.nose);
      }
      if (/dónde|donde|direcci|llegar|ubicaci|where|address|located|adresse|où|ou êtes|trouver/.test(s)) {
        var u = C.maps || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(C.nombre + ' ' + C.direccion));
        return bot(t.don, ' <a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t.mapa) + ' →</a>');
      }
      if (/vegan|vegetar|végé|vege|alérg|alerg|allerg|gluten|celiac|cel[ií]ac|sin carne|meat/.test(s)) return bot(t.veg);
      if (/recomend|plato|carta|men[uú]|comer|típico|especial|dish|eat|recommend|food|plat|spécialit|manger|conseill|recommand/.test(s)) {
        var extra = C.carta_url ? ' <a href="' + esc(C.carta_url) + '" target="_blank" rel="noopener">' + esc(({ es: 'Ver la carta', en: 'See the menu', fr: 'Voir la carte' })[L]) + ' →</a>' : '';
        return bot(t.pla, extra);
      }
      if (/gracias|thank|merci/.test(s)) return bot(t.gracias);
      if (/^(hola|buenas|hi|hello|hey|bonjour|salut)\b/.test(s)) return bot(t.hola);
      return bot(t.nose);
    }

    q('.asis-f').onsubmit = function (e) { e.preventDefault(); send(input.value); };
    setLang(L);
    window.__asistente = { send: send, abrir: abrir, config: C };
  }

  function iniciar() { cargar().then(montar).catch(function (e) { console.warn(e.message); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
