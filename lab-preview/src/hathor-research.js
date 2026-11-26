// LAB-only Hathor research panel. Sources and uncertainties are shown verbatim.
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function initHathorResearch() {
  const host = document.querySelector('.atlas-search-stack');
  if (!host) return;
  const panel = document.createElement('section');
  panel.className = 'panel hathor-research';
  panel.setAttribute('aria-label', 'Investigación táctica Hathor');
  panel.style.cssText = 'margin-top:1rem;padding:1rem;border:1px solid #426579;border-radius:12px';
  panel.innerHTML = '<h2>HATHOR · INTELIGENCIA TÁCTICA (LAB)</h2><small>Investigación documental preliminar. No confirma disponibilidad en LIVE ni presencia actual de jugadores.</small><div id="hathorResearchCards">Cargando investigación…</div>';
  host.insertAdjacentElement('afterend', panel);
  try {
    const response = await fetch('./data/hathor-research-verified.json', {cache:'no-store'});
    if (!response.ok) throw new Error('HTTP '+response.status);
    const data = await response.json();
    const cards = panel.querySelector('#hathorResearchCards');
    cards.innerHTML = (data.entries || []).map(item => {
      const section = (label, key) => '<div><strong>'+label+'</strong><ul>'+((item[key]||[]).map(x=>'<li>'+safe(x)+'</li>').join('')||'<li>Sin información contrastada</li>')+'</ul></div>';
      const sources = (item.sources||[]).filter(s=>/^https:\/\//.test(s)).map(s=>'<a href="'+safe(s)+'" target="_blank" rel="noopener noreferrer">Fuente externa</a>').join(' · ');
      return '<article style="padding:1rem 0;border-top:1px solid #426579"><h3>'+safe(item.name)+'</h3><p>'+safe(item.activity)+'</p>'+section('PvE','pve')+section('PvP','pvp')+section('Misiones','missions')+section('Botín','loot')+section('Peligros','hazards')+'<p><strong>Estado:</strong> '+safe(item.verification)+'</p><p>'+sources+'</p></article>';
    }).join('');
  } catch (err) {
    panel.querySelector('#hathorResearchCards').textContent = 'No se pudo cargar la investigación: '+err.message;
  }
}
initHathorResearch();
