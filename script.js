"use strict";

/*
  Prototipo funcional.
  - Incluye los ítems completos del área Personal/Social y los primeros ítems
    visibles del área Adaptativa del cuadernillo facilitado.
  - La conversión PD -> PC incluida en esta versión corresponde al tramo 0-5
    meses de las tablas N-3 y N-4 del PDF de baremos.
  - La estructura está preparada para incorporar el resto de áreas y baremos.
*/

const AGE_BANDS = [
  [0, 5, "0-5"], [6, 11, "6-11"], [12, 17, "12-17"], [18, 23, "18-23"],
  [24, 35, "24-35"], [36, 47, "36-47"], [48, 59, "48-59"],
  [60, 71, "60-71"], [72, 83, "72-83"], [84, 95, "84-95"]
];

const DATA = {
  personalSocial: {
    label: "Personal/Social",
    subareas: [
      {
        id: "adulto", label: "Interacción con el adulto", items: [
          ["PS1","0-5","Muestra conocimiento de la gente."], ["PS2","0-5","Mira la cara del adulto."],
          ["PS3","0-5","Sonríe o vocaliza en respuesta a la atención del adulto."], ["PS4","0-5","Explora las facciones del adulto."],
          ["PS5","0-5","Muestra deseos de ser cogido en brazos por una persona conocida."], ["PS6","6-11","Muestra deseos de recibir atención."],
          ["PS7","6-11","Participa en juegos como «cucú» o «el escondite»."], ["PS8","6-11","Distingue las personas conocidas de las no conocidas."],
          ["PS9","12-17","Sigue vocalizando cuando se le imita."], ["PS10","12-17","Reacciona cuando se nombra a un familiar."],
          ["PS11","18-23","Responde a las alabanzas, recompensas o promesas de recompensa del adulto."], ["PS12","18-23","Ayuda en tareas domésticas sencillas."],
          ["PS13","24-35","Saluda espontáneamente a los adultos conocidos."], ["PS14","36-47","Responde al contacto social de adultos conocidos."],
          ["PS15","36-47","Se separa fácilmente de sus padres."], ["PS16","60-71","Utiliza a los adultos (además de los padres), como recurso."],
          ["PS17","60-71","Inicia contactos con adultos conocidos."], ["PS18","72-83","Pide ayuda al adulto cuando lo necesita."]
        ]
      },
      {
        id: "afecto", label: "Expresión de sentimientos/afecto", items: [
          ["PS19","0-5","Reacciona con anticipación."], ["PS20","0-5","Muestra placer en juegos que implican movimientos bruscos."],
          ["PS21","0-5","Expresa emociones."], ["PS22","12-17","Muestra afecto por las personas, animales u objetos personales."],
          ["PS23","12-17","Le gusta jugar con otros niños."], ["PS24","18-23","Le gusta que le lean cuentos."],
          ["PS25","24-35","Expresa cariño o simpatía hacia un compañero."], ["PS26","36-47","Muestra entusiasmo en el trabajo o el juego."],
          ["PS27","36-47","Muestra simpatía hacia los demás."], ["PS28","48-59","Consuela a un compañero."],
          ["PS29","48-59","Describe sus sentimientos."], ["PS30","60-71","Muestra una actitud positiva hacia la escuela."]
        ]
      },
      {
        id: "autoconcepto", label: "Autoconcepto", items: [
          ["PS31","0-5","Muestra conocimiento de sus manos."], ["PS32","6-11","Responde a su nombre."],
          ["PS33","18-23","Expresa propiedad o posesión."], ["PS34","18-23","Se reconoce en el espejo."],
          ["PS35","24-35","Se enorgullece de sus éxitos."], ["PS36","24-35","Conoce su nombre."],
          ["PS37","24-35","Utiliza un pronombre o su nombre para referirse a sí mismo."], ["PS38","24-35","Habla positivamente de sí mismo."],
          ["PS39","24-35","Conoce su edad."], ["PS40","36-47","Atrae la atención de los demás sobre su actividad."],
          ["PS41","36-47","Conoce su nombre y apellidos."], ["PS42","48-59","Se «hace valer» socialmente."],
          ["PS43","60-71","Actúa para los demás."], ["PS44","60-71","Demuestra capacidad para explicar o contar alguna cosa sin demasiada vergüenza."]
        ]
      },
      {
        id: "companeros", label: "Interacción con los compañeros", items: [
          ["PS45","12-17","Inicia un contacto social con compañeros."], ["PS46","12-17","Imita a otro niño."],
          ["PS47","18-23","Juega solo junto a otros compañeros."], ["PS48","18-23","Juega al lado de otro niño."],
          ["PS49","24-35","Participa en juegos de grupo."], ["PS50","24-35","Comparte sus juguetes."],
          ["PS51","36-47","Se relaciona con los compañeros."], ["PS52","48-59","Tiene amigos."],
          ["PS53","48-59","Escoge a sus amigos."], ["PS54","48-59","Participa en el juego."],
          ["PS55","48-59","Participa en actividades de grupo."], ["PS56","48-59","Sabe compartir y esperar su turno."],
          ["PS57","60-71","Inicia contactos sociales e interacciones."], ["PS58","60-71","Participa en juegos competitivos."],
          ["PS59","60-71","Utiliza a los compañeros para obtener ayuda."], ["PS60","60-71","Da ideas a otros niños y aprueba las de los demás."],
          ["PS61","72-83","Actúa como líder en las relaciones con los compañeros."]
        ]
      },
      {
        id: "colaboracion", label: "Colaboración", items: [
          ["PS62","18-23","Sigue normas de la vida cotidiana."], ["PS63","24-35","Sigue las reglas dadas por un adulto."],
          ["PS64","48-59","Obedece las órdenes del adulto."], ["PS65","60-71","Obedece las normas y órdenes de la clase."],
          ["PS66","60-71","Espera su turno para conseguir la atención del adulto."], ["PS67","60-71","Busca alternativas para resolver un problema."],
          ["PS68","60-71","Hace frente a las burlas y riñas."], ["PS69","72-83","Participa en situaciones nuevas."],
          ["PS70","84-95","Utiliza al adulto para defenderse."], ["PS71","84-95","Se enfrenta a la agresión de un compañero."]
        ]
      },
      {
        id: "rol", label: "Rol social", items: [
          ["PS72","24-35","Juega representando papeles de adulto."], ["PS73","24-35","Representa un papel."],
          ["PS74","36-47","Sabe si es niño o niña."], ["PS75","36-47","Reconoce las diferencias entre hombre y mujer."],
          ["PS76","48-59","Reconoce expresiones faciales de sentimientos."], ["PS77","48-59","Juega representando el papel del adulto."],
          ["PS78","48-59","Ayuda cuando es necesario."], ["PS79","48-59","Respeta las cosas de los demás."],
          ["PS80","48-59","Pide permiso para utilizar las cosas de otro."], ["PS81","60-71","Reconoce los sentimientos de los demás."],
          ["PS82","60-71","Distingue las conductas aceptables de las no aceptables."], ["PS83","72-83","Distingue roles presentes y futuros."],
          ["PS84","84-95","Demuestra responsabilidad."], ["PS85","84-95","Reconoce la responsabilidad de sus errores."]
        ]
      }
    ]
  },
  adaptativa: {
    label: "Adaptativa",
    subareas: [
      {
        id: "atencion", label: "Atención", items: [
          ["A1","0-5","Dirige su mirada hacia un foco de luz."], ["A2","0-5","Mira un objeto durante cinco segundos."],
          ["A3","0-5","Presta atención a un sonido continuo."], ["A4","6-11","Sigue con la mirada una luz en un arco de 180°."],
          ["A5","6-11","Sigue con la mirada una luz en recorrido vertical."], ["A6","6-11","Se entretiene sin solicitar atención."],
          ["A7","12-17","Mira o señala un dibujo."], ["A8","18-23","Presta atención."],
          ["A9","36-47","Presta atención estando en grupo."], ["A10","36-47","Se concentra en su propia tarea."]
        ]
      },
      {
        id: "comida", label: "Comida", items: [
          ["A11","0-5","Reacciona anticipadamente a la comida."], ["A12","0-5","Come papilla con cuchara."],
          ["A13","6-11","Come semisólidos."], ["A14","6-11","Sostiene su biberón."],
          ["A15","6-11","Bebe en una taza con ayuda."], ["A16","6-11","Come trocitos de comida."],
          ["A17","12-17","Comienza a usar la cuchara o el tenedor para comer."], ["A18","12-17","Pide comida o bebida con palabras o gestos."],
          ["A19","18-23","Bebe en taza o vaso, sin ayuda."], ["A20","18-23","Utiliza la cuchara o el tenedor."],
          ["A21","18-23","Distingue lo comestible de lo no comestible."], ["A22","24-35","Obtiene agua del grifo."],
          ["A23","36-47","Se sirve comida."], ["A24","72-83","Utiliza el cuchillo."]
        ]
      }
    ]
  }
};

// Tablas N-3 y N-4 (0-5 meses). Los rangos se expresan como [mínimo, máximo, PC].
const NORMS_0_5 = {
  personalSocial: {
    subareas: {
      adulto: [[18,999,98],[17,17,88],[16,16,86],[15,15,80],[14,14,66],[13,13,64],[12,12,56],[11,11,52],[10,10,38],[9,9,34],[8,8,32],[7,7,24],[6,6,12],[5,5,10],[4,4,8],[3,3,6],[2,2,2],[0,1,1]],
      afecto: [[8,999,94],[7,7,86],[6,6,42],[5,5,22],[4,4,16],[3,3,14],[2,2,6],[1,1,4],[0,0,1]],
      autoconcepto: [[6,999,96],[5,5,94],[4,4,82],[3,3,74],[2,2,26],[1,1,20],[0,0,1]]
    },
    total: [[28,999,94],[26,27,86],[25,25,84],[24,24,80],[23,23,71],[22,22,65],[21,21,61],[20,20,51],[19,19,49],[18,18,43],[17,17,41],[16,16,39],[15,15,35],[14,14,29],[13,13,18],[12,12,16],[11,11,14],[9,10,12],[7,8,10],[6,6,6],[3,5,4],[2,2,2],[0,1,1]]
  },
  adaptativa: {
    subareas: {
      atencion: [[16,999,98],[15,15,96],[14,14,94],[13,13,88],[12,12,74],[11,11,70],[10,10,58],[9,9,48],[8,8,42],[7,7,40],[6,6,26],[5,5,22],[4,4,16],[3,3,10],[2,2,6],[1,1,2],[0,0,1]],
      comida: [[12,999,98],[9,11,96],[8,8,94],[7,7,92],[6,6,84],[5,5,80],[4,4,63],[3,3,51],[2,2,8],[1,1,6],[0,0,1]]
    },
    total: [[24,999,98],[21,23,96],[20,20,90],[19,19,88],[17,18,84],[16,16,78],[15,15,74],[14,14,61],[13,13,57],[12,12,47],[11,11,41],[10,10,39],[9,9,37],[8,8,24],[7,7,22],[6,6,18],[5,5,10],[4,4,6],[3,3,4],[2,2,2],[0,1,1]]
  }
};

const state = {
  currentArea: "personalSocial",
  scores: {},
  observations: {}
};

const el = {
  newBtn: document.querySelector("#newAssessmentBtn"),
  clearBtn: document.querySelector("#clearScoresBtn"),
  welcome: document.querySelector("#welcomeView"),
  assessment: document.querySelector("#assessmentView"),
  areaNav: document.querySelector("#areaNav"),
  items: document.querySelector("#itemsContainer"),
  results: document.querySelector("#resultsPanel"),
  birth: document.querySelector("#birthDate"),
  date: document.querySelector("#assessmentDate"),
  age: document.querySelector("#ageMonths"),
  ageBand: document.querySelector("#ageBandLabel")
};

function lookupPc(table, pd) {
  const row = table.find(([min, max]) => pd >= min && pd <= max);
  return row ? row[2] : null;
}

function getAgeBand(months) {
  const row = AGE_BANDS.find(([min,max]) => months >= min && months <= max);
  return row ? row[2] : null;
}

function calculateAgeMonths() {
  if (!el.birth.value || !el.date.value) return;
  const birth = new Date(`${el.birth.value}T12:00:00`);
  const assessment = new Date(`${el.date.value}T12:00:00`);
  if (assessment < birth) return;
  let months = (assessment.getFullYear() - birth.getFullYear()) * 12 + assessment.getMonth() - birth.getMonth();
  if (assessment.getDate() < birth.getDate()) months -= 1;
  el.age.value = Math.max(0, months);
  updateAgeBand();
}

function updateAgeBand() {
  const months = Number(el.age.value);
  const band = Number.isFinite(months) ? getAgeBand(months) : null;
  el.ageBand.textContent = band ? `${months} meses · tramo ${band}` : "Edad fuera de rango o sin definir";
  render();
}

function scoreForSubarea(subarea) {
  return subarea.items.reduce((sum, [code]) => sum + (state.scores[code] ?? 0), 0);
}

function areaPd(area) {
  return area.subareas.reduce((sum, subarea) => sum + scoreForSubarea(subarea), 0);
}

function renderNav() {
  el.areaNav.innerHTML = "";
  Object.entries(DATA).forEach(([key, area]) => {
    const button = document.createElement("button");
    button.className = `nav-button ${state.currentArea === key ? "active" : ""}`;
    button.textContent = area.label;
    button.addEventListener("click", () => { state.currentArea = key; render(); });
    el.areaNav.appendChild(button);
  });

  ["Motora", "Comunicación", "Cognitiva"].forEach(label => {
    const button = document.createElement("button");
    button.className = "nav-button";
    button.disabled = true;
    button.textContent = `${label} (siguiente fase)`;
    el.areaNav.appendChild(button);
  });
}

function renderResults(areaKey, area) {
  const pd = areaPd(area);
  const ageBand = getAgeBand(Number(el.age.value));
  const norms = ageBand === "0-5" ? NORMS_0_5[areaKey] : null;
  const pc = norms ? lookupPc(norms.total, pd) : null;
  const answered = area.subareas.flatMap(s => s.items).filter(([code]) => state.scores[code] !== undefined).length;
  const totalItems = area.subareas.reduce((sum, s) => sum + s.items.length, 0);

  el.results.innerHTML = `
    <div class="result-card"><span>Área</span><strong>${area.label}</strong></div>
    <div class="result-card"><span>Ítems puntuados</span><strong>${answered}/${totalItems}</strong></div>
    <div class="result-card"><span>Puntuación directa</span><strong>${pd}</strong></div>
    <div class="result-card"><span>Percentil del área</span><strong>${pc ?? "—"}</strong></div>
    ${norms ? "" : '<p class="result-note">En este prototipo la conversión automática a percentil está cargada para el tramo 0-5 meses. Las demás tablas se incorporarán en la siguiente fase.</p>'}
  `;
}

function groupByAge(items) {
  return items.reduce((acc, item) => {
    (acc[item[1]] ||= []).push(item);
    return acc;
  }, {});
}

function renderItems(areaKey, area) {
  el.items.innerHTML = `<h2 class="area-title">Área ${area.label}</h2>`;
  const ageBand = getAgeBand(Number(el.age.value));
  const norms = ageBand === "0-5" ? NORMS_0_5[areaKey] : null;

  area.subareas.forEach(subarea => {
    const section = document.createElement("section");
    section.className = "subarea";
    const pd = scoreForSubarea(subarea);
    const pc = norms?.subareas[subarea.id] ? lookupPc(norms.subareas[subarea.id], pd) : null;
    section.innerHTML = `
      <div class="subarea-header">
        <h3>Subárea: ${subarea.label}</h3>
        <div class="subarea-score">PD ${pd}${pc !== null ? ` · PC ${pc}` : ""}</div>
      </div>
    `;

    Object.entries(groupByAge(subarea.items)).forEach(([age, items]) => {
      const title = document.createElement("h4");
      title.className = "age-group-title";
      title.textContent = `${age} meses`;
      section.appendChild(title);

      items.forEach(([code,, text]) => {
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
          <div class="item-code">${code}</div>
          <div class="item-text">${text}</div>
          <div class="score-buttons" role="group" aria-label="Puntuación ${code}">
            ${[2,1,0].map(score => `<button class="score-button ${state.scores[code] === score ? "selected" : ""}" data-code="${code}" data-score="${score}">${score}</button>`).join("")}
          </div>
          <input class="observation" data-observation="${code}" type="text" value="${state.observations[code] ?? ""}" placeholder="Observaciones">
        `;
        section.appendChild(row);
      });
    });
    el.items.appendChild(section);
  });

  el.items.querySelectorAll(".score-button").forEach(button => {
    button.addEventListener("click", () => {
      state.scores[button.dataset.code] = Number(button.dataset.score);
      persist();
      render();
    });
  });

  el.items.querySelectorAll("[data-observation]").forEach(input => {
    input.addEventListener("input", () => {
      state.observations[input.dataset.observation] = input.value;
      persist();
    });
  });
}

function persist() {
  localStorage.setItem("battellePrototype", JSON.stringify({ scores: state.scores, observations: state.observations }));
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem("battellePrototype") || "null");
    if (saved) {
      state.scores = saved.scores || {};
      state.observations = saved.observations || {};
    }
  } catch { /* se ignora un almacenamiento corrupto */ }
}

function render() {
  renderNav();
  const area = DATA[state.currentArea];
  renderResults(state.currentArea, area);
  renderItems(state.currentArea, area);
}

el.newBtn.addEventListener("click", () => {
  el.welcome.classList.add("hidden");
  el.assessment.classList.remove("hidden");
  if (!el.date.value) el.date.value = new Date().toISOString().slice(0,10);
  render();
});

el.clearBtn.addEventListener("click", () => {
  if (!window.confirm("¿Borrar todas las puntuaciones y observaciones de esta evaluación?")) return;
  state.scores = {};
  state.observations = {};
  persist();
  render();
});

el.birth.addEventListener("change", calculateAgeMonths);
el.date.addEventListener("change", calculateAgeMonths);
el.age.addEventListener("input", updateAgeBand);

restore();
