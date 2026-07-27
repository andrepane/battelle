const ORIGINS = new Set(['observado', 'basal', 'techo']);

export function scorePresentation(response) {
  const origin = ORIGINS.has(response?.origen) ? response.origen : 'no_administrado';
  const score = origin === 'no_administrado' ? null : response.puntuacion;
  const label = origin === 'observado' ? `${score} OBS.`
    : origin === 'basal' ? '2 BASAL'
      : origin === 'techo' ? '0 TECHO' : '—';
  return { origin, score, label };
}

export function scoreButtonAccessibility(itemCode, buttonScore, response) {
  const shown = scorePresentation(response);
  const pressed = shown.score === buttonScore;
  let meaning = buttonScore === null ? 'no administrado' : `puntuación ${buttonScore}`;
  if (pressed && shown.origin === 'observado') meaning = `${buttonScore}, respuesta observada`;
  if (pressed && shown.origin === 'basal') meaning = '2 derivado por basal';
  if (pressed && shown.origin === 'techo') meaning = '0 derivado por techo';
  return { pressed, ariaLabel: `${itemCode}: ${meaning}`, origin: pressed ? shown.origin : 'opcion' };
}
